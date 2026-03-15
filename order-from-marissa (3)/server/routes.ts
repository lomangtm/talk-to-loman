import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { readFileSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";
import type { Menu, OrderItem } from "@shared/schema";

// Load menu data
const menuPath = resolve(process.cwd(), "menu.json");
let menu: Menu;
try {
  menu = JSON.parse(readFileSync(menuPath, "utf-8"));
} catch {
  menu = { restaurant_name: "Marissa's Kitchen", categories: [] };
}

// Build Marissa's system prompt dynamically from the menu
function buildSystemPrompt(): string {
  let menuText = "";
  for (const cat of menu.categories) {
    menuText += `\n## ${cat.name}\n`;
    for (const item of cat.items) {
      if (item.sizes && item.sizes.length > 0) {
        const sizeStr = item.sizes.map(s => `${s.name}: $${s.price.toFixed(2)}`).join(", ");
        menuText += `- ${item.name}: ${sizeStr}`;
      } else if (item.basePrice !== undefined) {
        menuText += `- ${item.name}: $${item.basePrice.toFixed(2)}`;
      }
      if (item.description) {
        menuText += ` — ${item.description}`;
      }
      if (item.modifiers && item.modifiers.length > 0) {
        const modStr = item.modifiers.map(m => m.price > 0 ? `${m.name} (+$${m.price.toFixed(2)})` : m.name).join(", ");
        menuText += ` [Modifiers: ${modStr}]`;
      }
      menuText += "\n";
    }
  }

  return `You are Marissa, a warm and efficient restaurant host at ${menu.restaurant_name}. You are taking phone/video orders from customers.

## Your Personality
- Warm, friendly, and natural — like a real person taking an order
- Efficient but never rushed — make customers feel welcome
- Knowledgeable about the full menu
- You gently upsell when it makes sense (e.g., "Want to add a side with that?" or "Our garlic bread pairs great with that")
- Confirm items as they're added: repeat back what the customer ordered
- If a customer is vague about size, ask them which size they'd like
- When wrapping up, read back the full order with totals
- Stay in character at all times — you're a restaurant host, not an AI assistant
- If someone asks off-topic questions, gently redirect: "Ha, good question! But let's get your food order in first — what sounds good?"
- Never say you're an AI unless directly and persistently asked

## The Menu
${menuText}

## Order-Taking Rules
1. Greet the customer warmly when they start
2. Listen for what they want to order
3. For items with sizes, always confirm the size
4. Mention popular modifiers when relevant
5. After each item, ask "What else can I get for you?"
6. When they say they're done, read back the complete order
7. Confirm the total including 8.25% tax
8. Thank them and let them know the order is confirmed

## Important
- All prices are in USD
- Tax rate is 8.25%
- Be conversational, not robotic
- Use natural speech patterns
- Keep responses concise — this is a voice conversation`;
}

// Track WebSocket clients per session
const wsClients = new Map<string, Set<WebSocket>>();

function broadcastOrderUpdate(sessionId: string) {
  const order = storage.getOrder(sessionId);
  const clients = wsClients.get(sessionId);
  if (!order || !clients) return;

  const message = JSON.stringify({ type: "order_update", order });
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // --- Menu API ---
  app.get("/api/menu", (_req, res) => {
    res.json(menu);
  });

  // --- LiveAvatar Session Token ---
  app.post("/api/liveavatar/token", async (_req, res) => {
    const apiKey = process.env.LIVEAVATAR_API_KEY;
    const avatarId = process.env.LIVEAVATAR_AVATAR_ID;
    const contextId = process.env.LIVEAVATAR_CONTEXT_ID;

    if (!apiKey || !avatarId) {
      return res.json({ sessionToken: null, error: "LiveAvatar not configured" });
    }

    try {
      const tokenRes = await fetch("https://api.liveavatar.com/v1/sessions/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-API-KEY": apiKey,
        },
        body: JSON.stringify({
          mode: "FULL",
          avatar_id: avatarId,
          avatar_persona: {
            language: "en",
            ...(contextId ? { context_id: contextId } : {}),
          },
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`LiveAvatar token creation failed: ${tokenRes.status} - ${errText}`);
      }

      const response = await tokenRes.json();
      const data = response.data || response;
      return res.json({
        sessionToken: data.session_token,
        sessionId: data.session_id,
      });
    } catch (error: any) {
      console.error("LiveAvatar token error:", error.message);
      return res.json({ sessionToken: null, error: error.message });
    }
  });

  // --- Avatar Config ---
  app.get("/api/liveavatar/config", (_req, res) => {
    const avatarId = process.env.LIVEAVATAR_AVATAR_ID;
    const apiKey = process.env.LIVEAVATAR_API_KEY;

    return res.json({
      avatarId: avatarId || null,
      isConfigured: !!(apiKey && avatarId),
    });
  });

  // --- Conversation Start (creates a session for order tracking) ---
  app.post("/api/conversation/start", async (_req, res) => {
    const session = storage.createSession();
    const apiKey = process.env.LIVEAVATAR_API_KEY;
    const avatarId = process.env.LIVEAVATAR_AVATAR_ID;

    const isDemo = !apiKey || !avatarId;

    storage.updateSession(session.sessionId, {
      status: "active",
      conversationUrl: "",
      conversationId: isDemo ? `demo-${session.sessionId}` : session.sessionId,
    });

    return res.json({
      sessionId: session.sessionId,
      status: "active",
      demo: isDemo,
    });
  });

  // --- Get Session ---
  app.get("/api/conversation/:sessionId", (req, res) => {
    const session = storage.getSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    return res.json(session);
  });

  // --- Update Order (add/remove items) ---
  app.post("/api/conversation/:sessionId/order", (req, res) => {
    const { sessionId } = req.params;
    const { action, item, itemId } = req.body;

    if (action === "add" && item) {
      const orderItem: OrderItem = {
        id: item.id || randomUUID(),
        name: item.name,
        size: item.size,
        modifiers: item.modifiers || [],
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice || item.unitPrice * (item.quantity || 1),
      };
      const order = storage.addOrderItem(sessionId, orderItem);
      if (!order) return res.status(404).json({ message: "Session not found" });
      broadcastOrderUpdate(sessionId);
      return res.json(order);
    }

    if (action === "remove" && itemId) {
      const order = storage.removeOrderItem(sessionId, itemId);
      if (!order) return res.status(404).json({ message: "Session not found" });
      broadcastOrderUpdate(sessionId);
      return res.json(order);
    }

    return res.status(400).json({ message: "Invalid action. Use 'add' or 'remove'." });
  });

  // --- Complete Order ---
  app.post("/api/order/:sessionId/complete", (req, res) => {
    const order = storage.completeOrder(req.params.sessionId);
    if (!order) return res.status(404).json({ message: "Session not found" });
    broadcastOrderUpdate(req.params.sessionId);
    return res.json(order);
  });

  // --- WebSocket for real-time order updates ---
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId) {
      ws.close(1008, "Missing sessionId");
      return;
    }

    if (!wsClients.has(sessionId)) {
      wsClients.set(sessionId, new Set());
    }
    wsClients.get(sessionId)!.add(ws);

    // Send current order state on connect
    const order = storage.getOrder(sessionId);
    if (order) {
      ws.send(JSON.stringify({ type: "order_update", order }));
    }

    ws.on("close", () => {
      const clients = wsClients.get(sessionId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) wsClients.delete(sessionId);
      }
    });
  });

  return httpServer;
}

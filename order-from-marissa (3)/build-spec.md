# Build Specification: Order from Marissa

## Overview
Full-stack web app for an interactive AI video ordering agent called "Order from Marissa" — embedded demo for the Loman.ai website. Visitors click a button and interact face-to-face with a photorealistic AI video avatar (Marissa) who takes their food order via voice.

## Project Location
`/home/user/workspace/order-from-marissa/` — already scaffolded from the webapp template with `npm install` done.

## Architecture Decision
The Tavus CVI API creates a `conversation_url` that renders in an iframe — it handles all video, audio, lip-sync, STT, TTS, and LLM internally. Our backend:
1. Creates a Tavus persona with Marissa's system prompt + menu context
2. Creates a conversation session that returns a `conversation_url`
3. Frontend embeds that URL in an iframe
4. Backend also maintains order state and serves the menu

Since Tavus handles the full voice pipeline internally, we do NOT need Deepgram, ElevenLabs, or Claude API for the conversation itself. The backend just needs to:
- Call Tavus API to create persona + conversation
- Serve menu data
- Track order state via WebSocket (for the sidebar)
- Finalize orders

## Tavus API Integration
Base URL: `https://tavusapi.com/v2`
Auth: `x-api-key` header with `TAVUS_API_KEY`

### Create Persona (POST /v2/personas)
```json
{
  "persona_name": "Marissa - Restaurant Host",
  "system_prompt": "<Marissa's full system prompt with menu>",
  "default_replica_id": "<set from env TAVUS_REPLICA_ID>"
}
```
Response: `{ "persona_id": "pcb7a34da5fe" }`

### Create Conversation (POST /v2/conversations)
```json
{
  "persona_id": "<from persona creation>",
  "replica_id": "<from env>",
  "conversation_name": "Order from Marissa - <session_id>",
  "conversational_context": "Customer is ordering food. Current order state: <json>",
  "custom_greeting": "Hey! Welcome in, I'm Marissa. What can I get started for you today?"
}
```
Response: `{ "conversation_id": "...", "conversation_url": "https://tavus.daily.co/...", "status": "active" }`

The `conversation_url` is embedded in an iframe in the frontend.

## Color / Design Direction
This is a Loman.ai product demo — restaurant tech, warm, premium feel.

### Palette (HSL `H S% L%` format for index.css):
**Light mode:**
- Background: `30 20% 97%` (warm off-white)
- Foreground: `20 15% 12%` (warm near-black)
- Card: `30 18% 95%`
- Card foreground: `20 15% 12%`
- Border: `25 10% 88%`
- Primary: `15 85% 50%` (warm coral/tomato red — Loman brand energy)
- Primary foreground: `0 0% 100%`
- Secondary: `30 12% 90%`
- Secondary foreground: `20 15% 15%`
- Muted: `25 10% 91%`
- Muted foreground: `20 8% 45%`
- Accent: `35 20% 92%`
- Accent foreground: `20 15% 12%`
- Destructive: `0 84% 42%`
- Destructive foreground: `0 0% 98%`
- Input: `25 8% 78%`
- Ring: `15 85% 50%`

**Dark mode (primary theme — dark feels more like a restaurant):**
- Background: `20 15% 8%` (warm charcoal)
- Foreground: `30 10% 92%`
- Card: `20 12% 11%`
- Card foreground: `30 10% 92%`
- Border: `20 8% 18%`
- Primary: `15 80% 55%` (slightly brighter coral for dark)
- Primary foreground: `0 0% 100%`
- Secondary: `20 10% 18%`
- Secondary foreground: `30 10% 92%`
- Muted: `20 8% 20%`
- Muted foreground: `25 6% 60%`
- Accent: `25 12% 17%`
- Accent foreground: `30 10% 92%`

### Typography
- Font: General Sans from Fontshare (clean, modern, friendly)
- Add to client/index.html: `<link href="https://api.fontshare.com/v2/css?f[]=general-sans@300,400,500,600,700&display=swap" rel="stylesheet">`
- `--font-sans: 'General Sans', sans-serif;`

## Files to Create/Modify

### Schema (`shared/schema.ts`)
Simple schema — mainly types for menu items, order items, and sessions:
```typescript
import { z } from "zod";

// Menu types (not DB tables — loaded from JSON)
export const menuModifierSchema = z.object({
  name: z.string(),
  price: z.number().default(0),
});

export const menuSizeSchema = z.object({
  name: z.string(),
  price: z.number(),
});

export const menuItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  basePrice: z.number().optional(),
  sizes: z.array(menuSizeSchema).optional(),
  modifiers: z.array(menuModifierSchema).optional(),
});

export const menuCategorySchema = z.object({
  name: z.string(),
  items: z.array(menuItemSchema),
});

export const menuSchema = z.object({
  restaurant_name: z.string(),
  categories: z.array(menuCategorySchema),
});

// Order types
export const orderItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.string().optional(),
  modifiers: z.array(z.string()).default([]),
  quantity: z.number().default(1),
  unitPrice: z.number(),
  totalPrice: z.number(),
});

export const orderSchema = z.object({
  sessionId: z.string(),
  items: z.array(orderItemSchema),
  subtotal: z.number(),
  tax: z.number(),
  total: z.number(),
  status: z.enum(["in_progress", "confirmed", "completed"]),
});

export type MenuItem = z.infer<typeof menuItemSchema>;
export type MenuCategory = z.infer<typeof menuCategorySchema>;
export type Menu = z.infer<typeof menuSchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;
export type Order = z.infer<typeof orderSchema>;

// Conversation session
export interface ConversationSession {
  sessionId: string;
  conversationId?: string;
  conversationUrl?: string;
  personaId?: string;
  order: Order;
  status: "idle" | "connecting" | "active" | "ended";
  transcript: Array<{ role: "user" | "marissa"; text: string; timestamp: number }>;
  createdAt: number;
}
```

### Storage (`server/storage.ts`)
Replace with:
```typescript
import { randomUUID } from "crypto";
import type { Order, OrderItem, ConversationSession } from "@shared/schema";

export interface IStorage {
  createSession(): ConversationSession;
  getSession(sessionId: string): ConversationSession | undefined;
  updateSession(sessionId: string, updates: Partial<ConversationSession>): ConversationSession | undefined;
  addOrderItem(sessionId: string, item: OrderItem): Order | undefined;
  removeOrderItem(sessionId: string, itemId: string): Order | undefined;
  updateOrder(sessionId: string, order: Partial<Order>): Order | undefined;
  getOrder(sessionId: string): Order | undefined;
  completeOrder(sessionId: string): Order | undefined;
}

export class MemStorage implements IStorage {
  private sessions: Map<string, ConversationSession>;

  constructor() {
    this.sessions = new Map();
  }

  createSession(): ConversationSession {
    const sessionId = randomUUID();
    const session: ConversationSession = {
      sessionId,
      order: {
        sessionId,
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        status: "in_progress",
      },
      status: "idle",
      transcript: [],
      createdAt: Date.now(),
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): ConversationSession | undefined {
    return this.sessions.get(sessionId);
  }

  updateSession(sessionId: string, updates: Partial<ConversationSession>): ConversationSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    Object.assign(session, updates);
    return session;
  }

  addOrderItem(sessionId: string, item: OrderItem): Order | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    session.order.items.push(item);
    this.recalculateOrder(session.order);
    return session.order;
  }

  removeOrderItem(sessionId: string, itemId: string): Order | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    session.order.items = session.order.items.filter(i => i.id !== itemId);
    this.recalculateOrder(session.order);
    return session.order;
  }

  updateOrder(sessionId: string, orderUpdate: Partial<Order>): Order | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    Object.assign(session.order, orderUpdate);
    if (orderUpdate.items) this.recalculateOrder(session.order);
    return session.order;
  }

  getOrder(sessionId: string): Order | undefined {
    return this.sessions.get(sessionId)?.order;
  }

  completeOrder(sessionId: string): Order | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    session.order.status = "confirmed";
    session.status = "ended";
    return session.order;
  }

  private recalculateOrder(order: Order) {
    order.subtotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
    order.tax = Math.round(order.subtotal * 0.0825 * 100) / 100; // 8.25% TX tax
    order.total = Math.round((order.subtotal + order.tax) * 100) / 100;
  }
}

export const storage = new MemStorage();
```

### Backend Routes (`server/routes.ts`)
Implement:
- `GET /api/menu` — returns the menu JSON
- `POST /api/conversation/start` — creates Tavus persona + conversation, returns session with conversation_url
- `GET /api/conversation/:sessionId` — get session state
- `POST /api/conversation/:sessionId/order` — update order (add/remove items)
- `POST /api/order/:sessionId/complete` — finalize order
- WebSocket at `/ws` path (using the existing ws setup) for real-time order state push

The Tavus integration should:
1. On `/api/conversation/start`:
   - Call `POST https://tavusapi.com/v2/personas` to create Marissa's persona with system prompt
   - Call `POST https://tavusapi.com/v2/conversations` with the persona_id to start conversation
   - Store the conversation_url and return it to frontend
   - If TAVUS_API_KEY is not set, return a demo/mock mode response so the app still works for UI testing

### Marissa's System Prompt
Build this dynamically with the full menu embedded. Marissa is warm, efficient, and stays in character. She:
- Greets naturally
- Knows the full menu
- Handles modifications
- Upsells naturally but not pushily
- Confirms items as added
- Handles ambiguity (sizes, etc.)
- Wraps up with total and confirmation
- Never says she's an AI unless directly asked
- Deflects off-topic questions back to ordering

### Menu JSON (`public/menu.json` or loaded from server)
Create a realistic menu with ~20 items across: Pizzas, Wings, Salads, Sandwiches, Sides, Drinks, Desserts.

### Frontend Pages/Components

#### `client/src/pages/home.tsx` — Landing Page
Full-viewport landing with:
- Large hero area with restaurant ambiance (gradient/pattern background)
- "Order from Marissa" headline
- Subtitle: "Experience AI-powered ordering — talk to Marissa, our virtual host"
- Big prominent CTA button that opens the conversation
- "Powered by Loman AI" branding with Loman logo link
- Feature highlights: "Natural conversation", "Real-time order tracking", "Instant confirmation"
- Footer with Perplexity attribution

#### `client/src/components/ConversationModal.tsx` — Main Experience
Full-screen modal/overlay when conversation is active:
- **Left/Center (60%)**: Tavus iframe showing Marissa's video
- **Right (40%)**: Order summary sidebar (scrollable)
- **Bottom overlay**: Live transcript/captions
- **Top bar**: "Talking to Marissa" status + end conversation button
- States: connecting (loading spinner), active (video + order), ended (confirmation)

#### `client/src/components/VideoAgent.tsx`
Wrapper for the Tavus conversation iframe:
- Renders `<iframe src={conversationUrl} allow="camera;microphone;display-capture" />`
- Handles loading state with skeleton/spinner
- Fallback state if Tavus is unavailable (show a static avatar image with message)
- Visual indicators for connection state

#### `client/src/components/OrderSummary.tsx`
Live order sidebar:
- Itemized list with name, size, modifiers, quantity, price
- Running subtotal, tax, total
- Remove item buttons
- Empty state: "Your order will appear here as you tell Marissa what you'd like"
- Animation when items are added (framer-motion)

#### `client/src/components/OrderConfirmation.tsx`
End screen:
- Itemized receipt
- Total with tax
- "Place Order" button (calls /api/order/complete)
- "Start New Order" button
- Success state with animation

#### `client/src/hooks/useConversation.ts`
Custom hook managing the conversation lifecycle:
- `startConversation()` — calls API, gets session + conversation_url
- `endConversation()` — cleanup
- Tracks session state, conversation URL, connection status
- WebSocket connection for real-time order updates

#### `client/src/hooks/useOrderState.ts`
Custom hook for order state:
- Connects to WebSocket for live order updates
- Provides `order`, `addItem`, `removeItem`, `clearOrder`
- Computes subtotal, tax, total

### Demo Mode
When `TAVUS_API_KEY` is not set:
- Backend returns a mock `conversation_url` that's empty
- Frontend shows a demo placeholder where the video would be (with Marissa's avatar image and a note "Connect your Tavus API key to enable live video")
- Order sidebar still works with manual "Add Item" buttons for testing
- This lets the UI be fully testable without API keys

### Widget Script (`client/public/widget.js`)
Lightweight embed script:
```javascript
(function() {
  const container = document.getElementById('loman-order-demo');
  if (!container) return;
  const config = {
    restaurantName: container.dataset.restaurant || 'Demo Restaurant',
    theme: container.dataset.theme || 'dark',
    apiBase: container.dataset.api || window.location.origin,
  };
  const iframe = document.createElement('iframe');
  iframe.src = config.apiBase;
  iframe.style.cssText = 'width:100%;height:700px;border:none;border-radius:12px;';
  iframe.allow = 'camera;microphone';
  container.appendChild(iframe);
})();
```

### Environment Files

#### `.env.example`
```
TAVUS_API_KEY=your_tavus_api_key_here
TAVUS_REPLICA_ID=your_replica_id_here
```

#### `Dockerfile`
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["node", "dist/index.cjs"]
```

#### `docker-compose.yml`
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "5000:5000"
    env_file: .env
    environment:
      - NODE_ENV=production
```

### Key Implementation Notes
1. The app defaults to dark mode (matches restaurant ambiance)
2. Use `useHashLocation` from wouter for routing (iframe compatibility)
3. Use `apiRequest` from queryClient for all API calls
4. All external links use `target="_blank" rel="noopener noreferrer"`
5. No localStorage/sessionStorage/cookies — use React state
6. The iframe for Tavus needs `allow="camera;microphone;display-capture"`
7. Mobile: order summary becomes a bottom sheet (using the Drawer component from vaul)
8. Add `data-testid` attributes to all interactive elements

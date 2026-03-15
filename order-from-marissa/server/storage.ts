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
    order.tax = Math.round(order.subtotal * 0.0825 * 100) / 100;
    order.total = Math.round((order.subtotal + order.tax) * 100) / 100;
  }
}

export const storage = new MemStorage();

import { z } from "zod";

// Menu types (loaded from JSON, not DB tables)
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
export type MenuSize = z.infer<typeof menuSizeSchema>;
export type MenuModifier = z.infer<typeof menuModifierSchema>;
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

import { useState, useEffect, useCallback, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { Order, OrderItem } from "@shared/schema";

const emptyOrder: Order = {
  sessionId: "",
  items: [],
  subtotal: 0,
  tax: 0,
  total: 0,
  status: "in_progress",
};

export function useOrderState(sessionId: string | null) {
  const [order, setOrder] = useState<Order>(emptyOrder);
  const wsRef = useRef<WebSocket | null>(null);

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    if (!sessionId) {
      setOrder(emptyOrder);
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?sessionId=${sessionId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "order_update" && data.order) {
            setOrder(data.order);
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onerror = () => {
        // Silently handle WebSocket errors
      };

      return () => {
        ws.close();
        wsRef.current = null;
      };
    } catch {
      // WebSocket connection failed, fall back to polling
      return;
    }
  }, [sessionId]);

  const addItem = useCallback(async (item: Omit<OrderItem, "id" | "totalPrice"> & { id?: string }) => {
    if (!sessionId) return;

    const totalPrice = item.unitPrice * (item.quantity || 1);
    try {
      const res = await apiRequest("POST", `/api/conversation/${sessionId}/order`, {
        action: "add",
        item: { ...item, totalPrice },
      });
      const updatedOrder = await res.json();
      setOrder(updatedOrder);
    } catch (error) {
      console.error("Failed to add item:", error);
    }
  }, [sessionId]);

  const removeItem = useCallback(async (itemId: string) => {
    if (!sessionId) return;

    try {
      const res = await apiRequest("POST", `/api/conversation/${sessionId}/order`, {
        action: "remove",
        itemId,
      });
      const updatedOrder = await res.json();
      setOrder(updatedOrder);
    } catch (error) {
      console.error("Failed to remove item:", error);
    }
  }, [sessionId]);

  const completeOrder = useCallback(async () => {
    if (!sessionId) return;

    try {
      const res = await apiRequest("POST", `/api/order/${sessionId}/complete`);
      const completedOrder = await res.json();
      setOrder(completedOrder);
      return completedOrder;
    } catch (error) {
      console.error("Failed to complete order:", error);
    }
  }, [sessionId]);

  const clearOrder = useCallback(() => {
    setOrder(emptyOrder);
  }, []);

  return {
    order,
    addItem,
    removeItem,
    completeOrder,
    clearOrder,
  };
}

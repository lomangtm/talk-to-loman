import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, PhoneOff, ChevronUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import VideoAgent from "./VideoAgent";
import OrderSummary from "./OrderSummary";
import OrderConfirmation from "./OrderConfirmation";
import { useOrderState } from "@/hooks/useOrderState";
import type { Menu, MenuItem } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { randomUUID } from "@/lib/utils";

interface ConversationModalProps {
  sessionId: string | null;
  isDemo: boolean;
  status: "idle" | "connecting" | "active" | "ended";
  onEnd: () => void;
  onNewOrder: () => void;
}

export default function ConversationModal({
  sessionId,
  isDemo,
  status,
  onEnd,
  onNewOrder,
}: ConversationModalProps) {
  const isMobile = useIsMobile();
  const { order, addItem, removeItem, completeOrder } = useOrderState(sessionId);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Fetch menu for demo mode quick-add
  const { data: menu } = useQuery<Menu>({
    queryKey: ["/api/menu"],
    enabled: isDemo,
  });

  const handleEndConversation = async () => {
    if (order.items.length > 0) {
      await completeOrder();
      setShowConfirmation(true);
    } else {
      onEnd();
    }
  };

  const handleNewOrder = () => {
    setShowConfirmation(false);
    onNewOrder();
  };

  // Quick add functions for demo mode
  const handleQuickAdd = (item: MenuItem, size?: string) => {
    const price = size
      ? item.sizes?.find(s => s.name === size)?.price || item.basePrice || 0
      : item.basePrice || (item.sizes?.[0]?.price) || 0;
    const selectedSize = size || (item.sizes?.[0]?.name) || undefined;

    addItem({
      id: randomUUID(),
      name: item.name,
      size: selectedSize,
      modifiers: [],
      quantity: 1,
      unitPrice: price,
    });
  };

  if (showConfirmation) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background flex items-center justify-center"
        data-testid="confirmation-screen"
      >
        <OrderConfirmation order={order} onNewOrder={handleNewOrder} />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
      data-testid="conversation-modal"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium">Talking to Marissa</span>
          {isDemo && (
            <Badge variant="secondary" className="text-xs" data-testid="demo-badge">Demo</Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-destructive"
          onClick={handleEndConversation}
          data-testid="end-conversation-button"
        >
          <PhoneOff className="w-4 h-4" />
          <span className="hidden sm:inline">End</span>
        </Button>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Video area */}
        <div className={`flex-1 flex flex-col p-4 min-h-0 ${isMobile ? 'pb-20' : ''}`}>
          <div className="flex-1 min-h-0 rounded-xl overflow-hidden">
            <VideoAgent
              isDemo={isDemo}
              status={status}
            />
          </div>

          {/* Demo mode quick-add bar */}
          {isDemo && menu && (
            <div className="mt-3 shrink-0">
              <DemoQuickAdd menu={menu} onAddItem={handleQuickAdd} />
            </div>
          )}
        </div>

        {/* Desktop: Side panel */}
        {!isMobile && (
          <div className="w-[340px] border-l border-border/60 bg-card/50 flex flex-col" data-testid="order-sidebar">
            <OrderSummary
              order={order}
              onRemoveItem={removeItem}
            />
          </div>
        )}
      </div>

      {/* Mobile: Bottom drawer */}
      {isMobile && (
        <Drawer open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
          <DrawerTrigger asChild>
            <button
              className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/60 px-4 py-3 flex items-center justify-between"
              data-testid="mobile-order-trigger"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Your Order</span>
                {order.items.length > 0 && (
                  <span className="bg-primary text-primary-foreground text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center">
                    {order.items.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {order.total > 0 && (
                  <span className="text-sm font-semibold text-primary">${order.total.toFixed(2)}</span>
                )}
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[70vh]" data-testid="mobile-order-drawer">
            <OrderSummary
              order={order}
              onRemoveItem={removeItem}
              isCompact
            />
          </DrawerContent>
        </Drawer>
      )}
    </motion.div>
  );
}

// Demo quick-add component
function DemoQuickAdd({ menu, onAddItem }: { menu: Menu; onAddItem: (item: MenuItem, size?: string) => void }) {
  const popularItems = menu.categories.flatMap(c => c.items).slice(0, 6);

  return (
    <div className="rounded-lg bg-card/50 border border-border/40 p-3" data-testid="demo-quick-add">
      <p className="text-xs font-medium text-muted-foreground mb-2.5">Quick Add (Demo)</p>
      <div className="flex flex-wrap gap-2">
        {popularItems.map(item => {
          const price = item.basePrice || item.sizes?.[0]?.price || 0;
          return (
            <button
              key={item.id}
              onClick={() => onAddItem(item)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-sm transition-colors"
              data-testid={`quick-add-${item.id}`}
            >
              <Plus className="w-3 h-3" />
              <span className="font-medium">{item.name}</span>
              <span className="text-muted-foreground text-xs">${price.toFixed(2)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

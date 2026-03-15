import { motion, AnimatePresence } from "framer-motion";
import { Trash2, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Order } from "@shared/schema";

interface OrderSummaryProps {
  order: Order;
  onRemoveItem: (itemId: string) => void;
  isCompact?: boolean;
}

export default function OrderSummary({ order, onRemoveItem, isCompact = false }: OrderSummaryProps) {
  const hasItems = order.items.length > 0;

  return (
    <div className={`flex flex-col h-full ${isCompact ? '' : ''}`}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border/60">
        <ShoppingBag className="w-4.5 h-4.5 text-primary" />
        <h3 className="font-semibold text-sm">Your Order</h3>
        {hasItems && (
          <span className="ml-auto bg-primary text-primary-foreground text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center" data-testid="order-item-count">
            {order.items.length}
          </span>
        )}
      </div>

      {/* Items */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-5 py-3">
          <AnimatePresence mode="popLayout">
            {!hasItems ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-10 text-center"
                data-testid="order-empty"
              >
                <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-4">
                  <UtensilsCrossed className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">No items yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px]">
                  Your order will appear here as you tell Marissa what you'd like
                </p>
              </motion.div>
            ) : (
              order.items.map((item, index) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="group"
                  data-testid={`order-item-${item.id}`}
                >
                  <div className="flex items-start gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{item.quantity}x {item.name}</p>
                          {item.size && (
                            <p className="text-xs text-muted-foreground mt-0.5">{item.size}</p>
                          )}
                          {item.modifiers.length > 0 && (
                            <p className="text-xs text-muted-foreground/70 mt-0.5">{item.modifiers.join(", ")}</p>
                          )}
                        </div>
                        <span className="text-sm font-medium text-foreground/80 shrink-0">
                          ${item.totalPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveItem(item.id)}
                      data-testid={`remove-item-${item.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {index < order.items.length - 1 && <Separator className="opacity-40" />}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Totals */}
      {hasItems && (
        <div className="border-t border-border/60 px-5 py-4 space-y-2" data-testid="order-totals">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">${order.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax (8.25%)</span>
            <span className="font-medium">${order.tax.toFixed(2)}</span>
          </div>
          <Separator className="opacity-40" />
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span className="text-primary" data-testid="order-total">${order.total.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

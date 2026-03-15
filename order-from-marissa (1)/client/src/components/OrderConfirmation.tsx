import { motion } from "framer-motion";
import { CheckCircle2, RotateCcw, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Order } from "@shared/schema";

interface OrderConfirmationProps {
  order: Order;
  onNewOrder: () => void;
}

export default function OrderConfirmation({ order, onNewOrder }: OrderConfirmationProps) {
  const isConfirmed = order.status === "confirmed" || order.status === "completed";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center max-w-md mx-auto w-full p-6"
      data-testid="order-confirmation"
    >
      {/* Success animation */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 15 }}
        className="mb-6"
      >
        <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
      </motion.div>

      <h2 className="text-xl font-bold mb-1">
        {isConfirmed ? "Order Confirmed!" : "Order Summary"}
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        {isConfirmed
          ? "Thanks for ordering with Marissa. Your food is being prepared!"
          : "Review your order below"}
      </p>

      {/* Receipt */}
      <div className="w-full rounded-xl bg-card border border-border/60 overflow-hidden" data-testid="order-receipt">
        <div className="flex items-center gap-2 px-5 py-3.5 bg-muted/30">
          <Receipt className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Order Receipt</span>
        </div>

        <div className="px-5 py-4 space-y-3">
          {order.items.map((item, index) => (
            <div key={item.id} data-testid={`receipt-item-${item.id}`}>
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {item.quantity}x {item.name}
                  </p>
                  {item.size && (
                    <p className="text-xs text-muted-foreground">{item.size}</p>
                  )}
                  {item.modifiers.length > 0 && (
                    <p className="text-xs text-muted-foreground/70">{item.modifiers.join(", ")}</p>
                  )}
                </div>
                <span className="text-sm font-medium shrink-0">${item.totalPrice.toFixed(2)}</span>
              </div>
              {index < order.items.length - 1 && <Separator className="mt-3 opacity-30" />}
            </div>
          ))}
        </div>

        <div className="border-t border-border/60 px-5 py-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>${order.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax (8.25%)</span>
            <span>${order.tax.toFixed(2)}</span>
          </div>
          <Separator className="opacity-30" />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span className="text-primary" data-testid="confirmation-total">${order.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 w-full">
        <Button
          onClick={onNewOrder}
          variant="outline"
          className="w-full gap-2"
          data-testid="new-order-button"
        >
          <RotateCcw className="w-4 h-4" />
          Start New Order
        </Button>
      </div>
    </motion.div>
  );
}

import type { OrderView } from "@/lib/form-state";
import type { Order } from "@/lib/types";

// What a customer may see of their own order. The designer's cost and commission on each item stay out of it.
export function toOrderView(o: Order): OrderView {
  return {
    code: o.code,
    items: o.items.map(({ designer: _designer, ...item }) => {
      void _designer;
      return item;
    }),
    total_inr: o.total_inr,
    discount_inr: o.discount_inr,
    discount_label: o.discount_label,
    payment_status: o.payment_status,
    order_status: o.order_status,
    refund_status: o.refund_status,
    verified_at: o.verified_at,
    created_at: o.created_at,
  };
}

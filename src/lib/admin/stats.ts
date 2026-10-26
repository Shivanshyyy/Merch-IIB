import type { Order } from "@/lib/types";

// An order that will actually be made and kept: paid, not cancelled, and not (being) refunded.
export const isLive = (o: Order) => o.payment_status === "verified" && o.order_status !== "cancelled" && o.refund_status !== "approved" && o.refund_status !== "refunded";

export const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];
export const sizeCompare = (a: string, b: string) => {
  const ia = SIZE_ORDER.indexOf(a);
  const ib = SIZE_ORDER.indexOf(b);
  return ia === -1 && ib === -1 ? a.localeCompare(b) : (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
};

export type Stats = {
  orders: number;
  cancelled: number;
  verified: number;
  pending: number; // payment waiting to be verified
  rejected: number;
  verifiedRevenue: number;
  pendingAmount: number;
  refundsOpen: number;
  refunded: number;
  refundedAmount: number;
  items: number; // units that will be made
  itemsBySize: { size: string; count: number }[];
};

export function computeStats(orders: Order[]): Stats {
  const s: Stats = { orders: orders.length, cancelled: 0, verified: 0, pending: 0, rejected: 0, verifiedRevenue: 0, pendingAmount: 0, refundsOpen: 0, refunded: 0, refundedAmount: 0, items: 0, itemsBySize: [] };
  const bySize = new Map<string, number>();

  for (const o of orders) {
    const cancelled = o.order_status === "cancelled";
    if (cancelled) s.cancelled++;
    if (o.payment_status === "pending" && !cancelled) {
      s.pending++;
      s.pendingAmount += o.total_inr;
    }
    if (o.payment_status === "rejected") s.rejected++;
    if (o.payment_status === "verified") s.verified++;
    if (o.refund_status === "requested" || o.refund_status === "approved") s.refundsOpen++;
    if (o.refund_status === "refunded") {
      s.refunded++;
      s.refundedAmount += o.total_inr;
    }
    if (isLive(o)) {
      s.verifiedRevenue += o.total_inr;
      for (const i of o.items) {
        s.items += i.qty;
        bySize.set(i.size, (bySize.get(i.size) ?? 0) + i.qty);
      }
    }
  }
  s.itemsBySize = [...bySize].map(([size, count]) => ({ size, count })).sort((a, b) => sizeCompare(a.size, b.size));
  return s;
}

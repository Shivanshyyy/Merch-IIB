// What each admin action does to an order. Pure, so the rules are testable and the UI can reuse them.
import { makeNameSchema, type NameRules } from "@/lib/schemas";
import type { Order, OrderItem, OrderPatch, OrderStatus, Product, RefundStatus } from "@/lib/types";

export type OrderAction =
  | { type: "verify" }
  | { type: "reject"; reason?: string }
  | { type: "reset_payment" }
  | { type: "status"; status: OrderStatus }
  | { type: "refund"; refund: RefundStatus }
  | { type: "edit_item"; index: number; name?: string; size?: string }
  | { type: "note"; note: string };

export type Plan = { ok: true; patch: OrderPatch; event: { type: string; note?: string }; message: string } | { ok: false; error: string };

export const STATUS_LABEL: Record<OrderStatus, string> = { placed: "Placed", in_production: "In production", ready: "Ready for pickup", collected: "Collected", cancelled: "Cancelled" };
export const REFUND_LABEL: Record<RefundStatus, string> = { none: "No refund", requested: "Refund requested", approved: "Refund approved", refunded: "Refunded" };

// Production, pickup and collection only make sense once the money is confirmed.
export const canFulfil = (o: Pick<Order, "payment_status">) => o.payment_status === "verified";
export const canRefund = (o: Pick<Order, "payment_status" | "verified_at">) => o.payment_status === "verified" || !!o.verified_at;

// Freebies offer: `taken` is how many orders already hold a spot.
// An unpaid order gives its freebie spot back.
const release = (o: Order): OrderPatch => (o.freebie ? { freebie: false } : {});

export type PromoCtx = { enabled: boolean; limit: number; taken: number };

export function planOrderAction(order: Order, action: OrderAction, ctx: { now: Date; products: Product[]; rules: NameRules; promo?: PromoCtx }): Plan {
  const fail = (error: string): Plan => ({ ok: false, error });

  switch (action.type) {
    case "verify":
      if (order.payment_status === "verified") return fail("Payment is already verified.");
      if (!order.freebie && ctx.promo?.enabled && ctx.promo.taken < ctx.promo.limit) {
        const spot = ctx.promo.taken + 1;
        const note = [order.utr ? `UTR ${order.utr}` : "", `Freebie ${spot}/${ctx.promo.limit}`].filter(Boolean).join(" · ");
        return { ok: true, patch: { payment_status: "verified", verified_at: ctx.now.toISOString(), freebie: true }, event: { type: "payment_verified", note }, message: `Payment verified · freebie ${spot}/${ctx.promo.limit}` };
      }
      return { ok: true, patch: { payment_status: "verified", verified_at: ctx.now.toISOString() }, event: { type: "payment_verified", note: order.utr ? `UTR ${order.utr}` : undefined }, message: "Payment verified" };

    case "reject":
      if (order.payment_status === "rejected") return fail("Payment is already rejected.");
      return { ok: true, patch: { payment_status: "rejected", verified_at: null, ...release(order) }, event: { type: "payment_rejected", note: action.reason?.trim() || undefined }, message: "Payment rejected" };

    case "reset_payment":
      if (order.payment_status === "pending") return fail("Payment is already pending.");
      return { ok: true, patch: { payment_status: "pending", verified_at: null, ...release(order) }, event: { type: "payment_reset" }, message: "Payment set back to pending" };

    case "status": {
      if (order.order_status === action.status) return fail(`Order is already ${STATUS_LABEL[action.status].toLowerCase()}.`);
      if (action.status !== "cancelled" && action.status !== "placed" && !canFulfil(order)) return fail("Verify the payment before moving this order forward.");
      return { ok: true, patch: { order_status: action.status }, event: { type: `status_${action.status}` }, message: `Marked ${STATUS_LABEL[action.status].toLowerCase()}` };
    }

    case "refund": {
      if (order.refund_status === action.refund) return fail(`Already: ${REFUND_LABEL[action.refund].toLowerCase()}.`);
      if (action.refund !== "none" && !canRefund(order)) return fail("Only an order with a verified payment can be refunded.");
      return { ok: true, patch: { refund_status: action.refund }, event: { type: `refund_${action.refund}` }, message: REFUND_LABEL[action.refund] };
    }

    case "edit_item": {
      const item = order.items[action.index];
      if (!item) return fail("That item doesn't exist.");
      const product = ctx.products.find((p) => p.slug === item.slug);
      const changes: string[] = [];
      const next: OrderItem = { ...item };

      if (action.name !== undefined) {
        const parsed = makeNameSchema(ctx.rules).safeParse(action.name);
        if (!parsed.success) return fail(`Name: letters, spaces and . ' - only, up to ${ctx.rules.nameMaxLength} characters.`);
        if (parsed.data && product && !product.personalizable) return fail("This product can't be personalised.");
        if (parsed.data !== item.name) {
          changes.push(`name "${item.name}" → "${parsed.data}"`);
          next.name = parsed.data;
        }
      }
      if (action.size !== undefined) {
        const size = action.size.trim().toUpperCase();
        if (!/^[A-Z0-9]{1,8}$/.test(size)) return fail("Size must be 1–8 letters or digits.");
        if (product && !product.sizes.includes(size)) return fail(`${product.name} isn't made in size ${size}.`);
        if (size !== item.size) {
          changes.push(`size ${item.size} → ${size}`);
          next.size = size;
        }
      }
      if (!changes.length) return fail("Nothing changed.");
      const items = order.items.map((it, i) => (i === action.index ? next : it));
      return { ok: true, patch: { items }, event: { type: "item_edited", note: `Item ${action.index + 1} (${item.productName}): ${changes.join(", ")}` }, message: "Item updated" };
    }

    case "note": {
      const note = action.note.trim().slice(0, 1000);
      if (note === (order.admin_note ?? "")) return fail("Nothing changed.");
      return { ok: true, patch: { admin_note: note }, event: { type: "note_updated", note: note || "(cleared)" }, message: note ? "Note saved" : "Note cleared" };
    }
  }
}

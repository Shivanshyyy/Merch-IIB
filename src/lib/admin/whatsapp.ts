import type { Settings } from "@/config/site";
import { whatsappUrl } from "@/config/site";
import { inr } from "@/lib/format";
import type { Batch, Order } from "@/lib/types";

export type Template = { key: string; label: string; text: string };

const firstName = (full: string) => full.trim().split(/\s+/)[0] || "there";

export function templatesFor(o: Order, s: Settings, batch?: Batch | null): Template[] {
  const hi = `Hi ${firstName(o.full_name)},`;
  const pickup = `${s.pickupLocation}, ${s.pickupRoom} (${s.pickupHours})`;
  const t = (key: string, label: string, text: string): Template => ({ key, label, text });
  return [
    t("payment_reminder", "Payment reminder", `${hi} this is ${s.contactName} from ${s.brand}. We haven't received payment for order ${o.code} (${inr(o.total_inr)}) yet. You can pay by UPI to ${s.upiId} (put ${o.code} in the note) and send the screenshot here.`),
    t("payment_verified", "Payment verified", `${hi} we've verified your payment for order ${o.code}. ${batch ? `It's part of ${batch.name}, which goes to the vendor after it closes. ` : ""}We'll message you when it's ready at ${s.pickupLocation}.`),
    t("payment_issue", "Payment problem", `${hi} we couldn't match your payment for order ${o.code} (${inr(o.total_inr)}). Could you send the payment screenshot or the UTR number?`),
    t("in_production", "In production", `${hi} order ${o.code} is in production now.${batch?.est_delivery ? ` Estimated delivery: ${batch.est_delivery}.` : ""} We'll message you as soon as it's ready.`),
    t("ready", "Ready for pickup", `${hi} your order ${o.code} is ready at ${pickup}. Please bring your order code.`),
    t("collected", "After pickup", `${hi} thanks for collecting order ${o.code}! If anything is defective, misprinted or the wrong item, tell us within ${s.refundWindowDays} days of pickup and we'll make it right.`),
    t("refund_approved", "Refund approved", `${hi} your refund for order ${o.code} (${inr(o.total_inr)}) is approved. We'll send it back by UPI shortly.`),
    t("refund_done", "Refund sent", `${hi} we've sent your refund for order ${o.code} (${inr(o.total_inr)}) by UPI. Let us know if you don't see it.`),
    t("cancelled", "Order cancelled", `${hi} order ${o.code} has been cancelled as discussed. Message us if you need anything else.`),
  ];
}

// The message that fits where the order is right now.
export function defaultTemplateKey(o: Order): string {
  if (o.refund_status === "refunded") return "refund_done";
  if (o.refund_status === "approved") return "refund_approved";
  if (o.order_status === "cancelled") return "cancelled";
  if (o.payment_status === "rejected") return "payment_issue";
  if (o.payment_status === "pending") return "payment_reminder";
  if (o.order_status === "collected") return "collected";
  if (o.order_status === "ready") return "ready";
  if (o.order_status === "in_production") return "in_production";
  return "payment_verified";
}

// Customers' numbers are stored as 10-digit Indian mobiles.
export const customerWhatsApp = (phone: string, text: string) => whatsappUrl(`91${phone.replace(/\D/g, "").slice(-10)}`, text);

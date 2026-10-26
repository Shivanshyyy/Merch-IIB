"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import type { TrackState, UtrState } from "@/lib/form-state";
import { orderCodeSchema, trackSchema, utrSchema } from "@/lib/schemas";

// Uniform delay on misses so guessing codes isn't free. Real rate limiting needs infra (see README).
const slowMiss = () => new Promise((r) => setTimeout(r, 600));

export async function submitUtr(_prev: UtrState, formData: FormData): Promise<UtrState> {
  const code = orderCodeSchema.safeParse(String(formData.get("code") ?? ""));
  const utr = utrSchema.safeParse(String(formData.get("utr") ?? ""));
  if (!code.success) return { ok: false, error: "Order not found." };
  if (!utr.success) return { ok: false, error: z.flattenError(utr.error).formErrors[0] ?? "Invalid UTR" };

  try {
    const d = db();
    const order = await d.getOrderByCode(code.data);
    // Only while payment is pending, so a guessed code can't rewrite a settled order.
    if (!order || !(await d.setUtr(code.data, utr.data))) {
      await slowMiss();
      return { ok: false, error: "We couldn't save that. If you've already paid, send the screenshot on WhatsApp." };
    }
    await d.addEvent(order.id, "utr_submitted", utr.data);
    return { ok: true, message: "Got it. This helps us verify your payment faster." };
  } catch (e) {
    console.error("[submitUtr]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function lookupOrders(_prev: TrackState, formData: FormData): Promise<TrackState> {
  const parsed = trackSchema.safeParse({ email: String(formData.get("email") ?? ""), code: String(formData.get("code") ?? "") });
  if (!parsed.success) {
    const fe = z.flattenError(parsed.error).fieldErrors;
    return { ok: false, fieldErrors: { email: fe.email?.[0], code: fe.code?.[0] } };
  }

  try {
    const d = db();
    const owned = await d.getOrderByCode(parsed.data.code);
    // One order code proves the caller knows the email's order, so strangers can't look people up by email alone.
    if (!owned || owned.email !== parsed.data.email) {
      await slowMiss();
      return { ok: false, error: "We couldn't find an order with that email and code. Check both and try again." };
    }
    const all = await d.listOrdersByEmail(parsed.data.email);
    return {
      ok: true,
      orders: all.map((o) => ({
        code: o.code,
        items: o.items,
        total_inr: o.total_inr,
        payment_status: o.payment_status,
        order_status: o.order_status,
        refund_status: o.refund_status,
        verified_at: o.verified_at,
        created_at: o.created_at,
      })),
    };
  } catch (e) {
    console.error("[lookupOrders]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

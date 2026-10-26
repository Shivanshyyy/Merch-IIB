"use server";

import { z } from "zod";
import { site } from "@/config/site";
import { CodeTakenError, db } from "@/lib/db";
import type { CheckoutState } from "@/lib/form-state";
import { generateOrderCode } from "@/lib/order-code";
import { priceOrder } from "@/lib/pricing";
import { checkoutSchema, type CheckoutField } from "@/lib/schemas";

const text = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function placeOrder(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const values = Object.fromEntries(["fullName", "email", "phone", "hostel", "room"].map((k) => [k, text(formData, k)]));

  // Honeypot: real users never see this field. Answer like a generic failure so bots learn nothing.
  if (text(formData, "fax")) return { ok: false, message: "Something went wrong. Please try again.", values };

  let items: unknown = [];
  try {
    items = JSON.parse(text(formData, "items") || "[]");
  } catch {
    return { ok: false, message: "Your cart couldn't be read. Please refresh and try again.", values };
  }

  const parsed = checkoutSchema.safeParse({
    ...values,
    confirmSpelling: formData.get("confirmSpelling") === "on",
    confirmPolicy: formData.get("confirmPolicy") === "on",
    items,
  });
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error).fieldErrors as Partial<Record<CheckoutField, string[]>>;
    const fieldErrors = Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v?.[0] ?? "Invalid"]));
    return { ok: false, fieldErrors, message: "Please fix the highlighted fields.", values };
  }
  const input = parsed.data;

  try {
    const d = db();

    const batch = await d.getOpenBatch();
    const now = Date.now();
    if (!batch || now < Date.parse(batch.opens_at) || now >= Date.parse(batch.closes_at)) {
      return { ok: false, message: "Preorders are closed right now. Check back when the next batch opens.", values };
    }

    // Re-price from the database: the client's totals are never trusted.
    const priced = priceOrder(input.items, await d.listActiveProducts());
    if (!priced.ok) return { ok: false, message: priced.message, values };

    const pending = await d.countPendingOrders(input.email);
    if (pending >= site.maxPendingOrdersPerEmail) {
      return {
        ok: false,
        message: `You already have ${pending} unpaid orders. Pay for one of them, or message ${site.contact.name} on WhatsApp to cancel, before placing another.`,
        values,
      };
    }

    for (let attempt = 0; attempt < 6; attempt++) {
      const code = generateOrderCode();
      try {
        const order = await d.insertOrder({
          code,
          batch_id: batch.id,
          email: input.email,
          full_name: input.fullName,
          phone: input.phone,
          hostel: input.hostel,
          room: input.room,
          items: priced.items,
          total_inr: priced.total,
        });
        await d.addEvent(order.id, "placed", `Total ₹${priced.total}`);
        return { ok: true, code, values };
      } catch (e) {
        if (!(e instanceof CodeTakenError)) throw e;
      }
    }
    throw new Error("could not allocate a unique order code");
  } catch (e) {
    console.error("[placeOrder]", e);
    return { ok: false, message: "We couldn't place your order. Nothing was charged. Please try again in a moment.", values };
  }
}

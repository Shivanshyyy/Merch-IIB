import "server-only";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/types";
import { CodeTakenError, db } from "@/lib/db";
import type { CheckoutState } from "@/lib/form-state";
import { generateOrderCode } from "@/lib/order-code";
import { priceOrder } from "@/lib/pricing";
import { makeCheckoutSchema, type CheckoutField } from "@/lib/schemas";
import { getSettingsFresh } from "@/lib/settings";

export type PlaceOrderInput = {
  values: Record<"fullName" | "phone" | "hostel" | "room", string>;
  items: unknown;
  confirmSpelling: boolean;
  confirmPolicy: boolean;
};

// Identity and email come from the session, never from the form. Prices come from the database, never from the client.
export async function placeOrderFor(user: SessionUser, input: PlaceOrderInput): Promise<CheckoutState> {
  const { values } = input;
  const settings = await getSettingsFresh();

  const parsed = makeCheckoutSchema(settings).safeParse({ ...values, confirmSpelling: input.confirmSpelling, confirmPolicy: input.confirmPolicy, items: input.items });
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error).fieldErrors as Partial<Record<CheckoutField, string[]>>;
    const fieldErrors = Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v?.[0] ?? "Invalid"]));
    return { ok: false, fieldErrors, message: "Please fix the highlighted fields.", values };
  }
  const data = parsed.data;

  try {
    const d = db();

    const batch = await d.getOpenBatch();
    const now = Date.now();
    if (!batch || now < Date.parse(batch.opens_at) || now >= Date.parse(batch.closes_at)) {
      return { ok: false, message: "Preorders are closed right now. Check back when the next batch opens.", values };
    }

    const priced = priceOrder(data.items, await d.listActiveProducts(), settings);
    if (!priced.ok) return { ok: false, message: priced.message, values };

    const pending = await d.countPendingOrders(user.id);
    if (pending >= settings.maxPendingOrdersPerEmail) {
      return {
        ok: false,
        message: `You already have ${pending} unpaid orders. Pay for one of them, or message ${settings.contactName} on WhatsApp to cancel, before placing another.`,
        values,
      };
    }

    for (let attempt = 0; attempt < 6; attempt++) {
      const code = generateOrderCode();
      try {
        const order = await d.insertOrder({
          code,
          batch_id: batch.id,
          user_id: user.id,
          email: user.email,
          full_name: data.fullName,
          phone: data.phone,
          hostel: data.hostel,
          room: data.room,
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

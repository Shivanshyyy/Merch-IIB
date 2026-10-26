import "server-only";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/types";
import { db } from "@/lib/db";
import type { UtrState } from "@/lib/form-state";
import { orderCodeSchema, utrSchema } from "@/lib/schemas";

const slowMiss = () => new Promise((r) => setTimeout(r, 600));

// The customer attaches their UTR to their own order, while payment is still pending.
export async function saveUtrFor(user: SessionUser, codeInput: string, utrInput: string): Promise<UtrState> {
  const code = orderCodeSchema.safeParse(codeInput);
  const utr = utrSchema.safeParse(utrInput);
  if (!code.success) return { ok: false, error: "Order not found." };
  if (!utr.success) return { ok: false, error: z.flattenError(utr.error).formErrors[0] ?? "Invalid UTR" };

  try {
    const d = db();
    const order = await d.getOrderByCode(code.data);
    // Owner only, and only while pending, so nobody can rewrite someone else's (or a settled) order.
    if (!order || order.user_id !== user.id || !(await d.setUtr(code.data, utr.data))) {
      await slowMiss();
      return { ok: false, error: "We couldn't save that. If you've already paid, send the screenshot on WhatsApp." };
    }
    await d.addEvent(order.id, "utr_submitted", utr.data);
    return { ok: true, message: "Got it. This helps us verify your payment faster." };
  } catch (e) {
    console.error("[saveUtr]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction } from "@/lib/admin/guard";
import { planOrderAction, type OrderAction } from "@/lib/admin/order-flow";
import { db, NotFoundError } from "@/lib/db";
import { getSettingsFresh } from "@/lib/settings";

// The action arrives from the browser, so its shape is checked like any other input.
const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("verify") }),
  z.object({ type: z.literal("reject"), reason: z.string().max(300).optional() }),
  z.object({ type: z.literal("reset_payment") }),
  z.object({ type: z.literal("status"), status: z.enum(["placed", "in_production", "ready", "collected", "cancelled"]) }),
  z.object({ type: z.literal("refund"), refund: z.enum(["none", "requested", "approved", "refunded"]) }),
  z.object({ type: z.literal("edit_item"), index: z.number().int().min(0).max(50), name: z.string().max(60).optional(), size: z.string().max(8).optional() }),
  z.object({ type: z.literal("note"), note: z.string().max(1000) }),
]);

export async function applyOrderAction(orderId: string, action: OrderAction) {
  return adminAction(async () => {
    const parsed = actionSchema.safeParse(action);
    if (!parsed.success || !z.uuid().safeParse(orderId).success) return { ok: false as const, message: "That action isn't valid." };
    try {
      const d = db();
      const [order, products, settings] = await Promise.all([d.getOrderById(orderId), d.listAllProducts(), getSettingsFresh()]);
      if (!order) return { ok: false as const, message: "Order not found." };
      const plan = planOrderAction(order, parsed.data, { now: new Date(), products, rules: settings });
      if (!plan.ok) return { ok: false as const, message: plan.error };
      await d.patchOrder(order.id, plan.patch, plan.event);
      revalidatePath("/admin", "layout");
      return { ok: true as const, message: plan.message };
    } catch (e) {
      if (e instanceof NotFoundError) return { ok: false as const, message: "Order not found." };
      console.error("[admin applyOrderAction]", e);
      return { ok: false as const, message: "Something went wrong. Nothing was changed." };
    }
  });
}

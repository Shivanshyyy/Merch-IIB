"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { planDesignerAction, payoutProblem, type DesignerAction } from "@/lib/admin/designer-flow";
import { adminAction } from "@/lib/admin/guard";
import { payoutSchema } from "@/lib/admin/schemas";
import { db } from "@/lib/db";
import { summarizeDesigner } from "@/lib/designer/sales";
import type { FormState } from "@/lib/form-state";

const text = (f: FormData, k: string) => String(f.get(k) ?? "");
const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
const firstErrors = (error: z.ZodError) => Object.fromEntries(Object.entries(z.flattenError(error).fieldErrors).map(([k, v]) => [k, (v as string[])[0]]));
const refresh = () => revalidatePath("/admin", "layout");

function actionFrom(intent: string, commission: number, note: string): DesignerAction | null {
  switch (intent) {
    case "approve":
      return { type: "approve", commission, note };
    case "reject":
      return { type: "reject", note };
    case "suspend":
      return { type: "suspend", note };
    case "reinstate":
      return { type: "reinstate" };
    case "set_commission":
      return { type: "set_commission", commission };
    default:
      return null;
  }
}

// One form, several buttons: the clicked button's value says what the admin decided.
export async function decideDesigner(_prev: FormState, formData: FormData): Promise<FormState> {
  return adminAction(async () => {
    const id = text(formData, "id");
    const values = { commission: text(formData, "commission"), note: text(formData, "note") };
    if (!z.uuid().safeParse(id).success) return { ok: false, message: "Designer not found.", values };
    const action = actionFrom(text(formData, "intent"), num(values.commission), values.note);
    if (!action) return { ok: false, message: "Choose what to do.", values };

    try {
      const d = db();
      const designer = await d.getDesigner(id);
      if (!designer) return { ok: false, message: "Designer not found.", values };
      const plan = planDesignerAction(designer, action);
      if (!plan.ok) return { ok: false, message: plan.message, fieldErrors: plan.message.startsWith("The commission") ? { commission: plan.message } : undefined, values };
      await d.decideDesigner(id, plan.decision);
      refresh();
      return { ok: true, message: plan.message, values: { commission: String(plan.decision.commission_pct ?? ""), note: plan.decision.decision_note ?? "" } };
    } catch (e) {
      console.error("[admin decideDesigner]", e);
      return { ok: false, message: "Couldn't save the decision.", values };
    }
  });
}

// Records money already sent to the designer. The balance is recomputed here, not trusted from the page.
export async function recordPayout(_prev: FormState, formData: FormData): Promise<FormState> {
  return adminAction(async () => {
    const designerId = text(formData, "designerId");
    const values = { amount: text(formData, "amount"), reference: text(formData, "reference"), note: text(formData, "note") };
    if (!z.uuid().safeParse(designerId).success) return { ok: false, message: "Designer not found.", values };
    const parsed = payoutSchema.safeParse({ amount: num(values.amount), reference: values.reference, note: values.note });
    if (!parsed.success) return { ok: false, fieldErrors: firstErrors(parsed.error), message: "Please fix the highlighted fields.", values };

    try {
      const d = db();
      if (!(await d.getDesigner(designerId))) return { ok: false, message: "Designer not found.", values };
      const [orders, payouts] = await Promise.all([d.listOrdersWithDesigner(designerId), d.listPayouts(designerId)]);
      const problem = payoutProblem(summarizeDesigner(orders, designerId, payouts), parsed.data.amount);
      if (problem) return { ok: false, fieldErrors: { amount: problem }, message: "Please fix the highlighted fields.", values };
      await d.createPayout({ designer_id: designerId, amount_inr: parsed.data.amount, reference: parsed.data.reference, note: parsed.data.note });
    } catch (e) {
      console.error("[admin recordPayout]", e);
      return { ok: false, message: "Couldn't record the payout.", values };
    }
    refresh();
    return { ok: true, message: "Payout recorded.", values: { amount: "", reference: "", note: "" } };
  });
}

export async function removePayout(payoutId: string) {
  return adminAction(async () => {
    if (!z.uuid().safeParse(payoutId).success) return { ok: false as const, message: "Payout not found." };
    try {
      await db().deletePayout(payoutId);
    } catch (e) {
      console.error("[admin removePayout]", e);
      return { ok: false as const, message: "Couldn't remove the payout." };
    }
    refresh();
    return { ok: true as const, message: "Payout removed." };
  });
}

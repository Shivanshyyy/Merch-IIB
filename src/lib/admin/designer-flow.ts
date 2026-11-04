import { isValidCommission, unitCommission, unitProfit } from "@/lib/designer/commission";
import { canMove } from "@/lib/designer/design-flow";
import { slugify } from "@/lib/format";
import type { DesignerSummary } from "@/lib/designer/sales";
import type { Design, DesignPatch, Designer, DesignerDecision } from "@/lib/types";

// ---- designer accounts

export type DesignerAction =
  | { type: "approve"; commission: number; note?: string }
  | { type: "reject"; note?: string }
  | { type: "suspend"; note?: string }
  | { type: "reinstate" }
  | { type: "set_commission"; commission: number };

type Plan<T> = ({ ok: true } & T) | { ok: false; message: string };
const fail = (message: string) => ({ ok: false as const, message });
const clean = (note?: string) => note?.trim().slice(0, 500) || null;
const RANGE = "The commission must be a whole number from 4 to 10.";

export function planDesignerAction(designer: Designer, action: DesignerAction): Plan<{ decision: DesignerDecision; message: string }> {
  const { status, commission_pct: pct } = designer;
  switch (action.type) {
    case "approve":
      if (status !== "pending" && status !== "rejected") return fail("Only a pending or rejected application can be approved.");
      if (!isValidCommission(action.commission)) return fail(RANGE);
      return { ok: true, decision: { status: "approved", commission_pct: action.commission, decision_note: clean(action.note) }, message: "Designer approved." };
    case "reject":
      if (status !== "pending") return fail("Only a pending application can be rejected.");
      return { ok: true, decision: { status: "rejected", commission_pct: pct, decision_note: clean(action.note) }, message: "Application rejected." };
    case "suspend":
      if (status !== "approved") return fail("Only an approved designer can be suspended.");
      return { ok: true, decision: { status: "suspended", commission_pct: pct, decision_note: clean(action.note) }, message: "Designer suspended." };
    case "reinstate":
      if (status !== "suspended") return fail("Only a suspended designer can be reinstated.");
      if (pct === null) return fail("This designer has no commission yet. Approve them with one instead.");
      return { ok: true, decision: { status: "approved", commission_pct: pct, decision_note: null }, message: "Designer reinstated." };
    case "set_commission":
      if (status !== "approved" && status !== "suspended") return fail("Set a commission when you approve the designer.");
      if (!isValidCommission(action.commission)) return fail(RANGE);
      return { ok: true, decision: { status, commission_pct: action.commission, decision_note: designer.decision_note }, message: `Commission set to ${action.commission}%. It applies to new orders.` };
  }
}

// ---- design review

export type DesignReview = { type: "approve"; note?: string } | { type: "changes"; note: string } | { type: "reject"; note: string };

export function planDesignReview(design: Design, review: DesignReview, now: Date): Plan<{ patch: DesignPatch; message: string }> {
  const note = clean(review.note);
  const reviewed_at = now.toISOString();
  if (review.type === "approve") {
    if (!canMove(design.status, "approved")) return fail("Only a design that's in review can be approved.");
    return { ok: true, patch: { status: "approved", review_note: note, reviewed_at }, message: "Design approved. You can put it live now." };
  }
  const to = review.type === "changes" ? "changes_requested" : "rejected";
  if (!canMove(design.status, to)) return fail("This design can't be sent back from its current status.");
  if (!note || note.length < 3) return fail(review.type === "changes" ? "Say what needs to change, so the designer knows." : "Give the designer a reason.");
  return { ok: true, patch: { status: to, review_note: note, reviewed_at }, message: review.type === "changes" ? "Sent back to the designer." : "Design rejected." };
}

// ---- publishing

// "lake-hoodie", or "lake-hoodie-2" when that's taken.
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const root = slugify(base).slice(0, 56) || "design";
  if (!used.has(root)) return root;
  for (let n = 2; ; n++) {
    const candidate = `${root}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

// What the admin will see before publishing: what each unit earns the designer at this price, cost and rate.
export function commissionPreview(priceInr: number, costInr: number, pct: number) {
  return { profit: unitProfit(priceInr, costInr), commission: unitCommission(priceInr, costInr, pct) };
}

export function canPublish(design: Design, designer: Designer | null): string | null {
  if (!canMove(design.status, "live")) return "Only an approved design can be put live.";
  if (design.colorways.length === 0) return "The design has no garment colours. Ask the designer to add one.";
  if (design.images.length === 0) return "The design has no images.";
  if (!designer || designer.status !== "approved" || designer.commission_pct === null) return "The designer isn't approved, so their design can't go live.";
  return null;
}

// ---- payouts

// Paying more than what's owed is almost always a typo, so it needs a deliberate fix first.
export function payoutProblem(summary: Pick<DesignerSummary, "balanceInr">, amountInr: number): string | null {
  if (!Number.isInteger(amountInr) || amountInr < 1) return "Enter the amount in whole rupees.";
  if (amountInr > summary.balanceInr) return `That's more than the balance of ₹${Math.max(0, summary.balanceInr).toLocaleString("en-IN")}.`;
  return null;
}

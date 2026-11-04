import { site } from "@/config/site";
import type { OrderItem, ProductTerms } from "@/lib/types";

const { min, max } = site.designerCommission;

export const COMMISSION_MIN = min;
export const COMMISSION_MAX = max;

export const isValidCommission = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;

// Profit on one unit at list price; the name-print fee and cart discounts are not part of it.
export const unitProfit = (priceInr: number, costInr: number) => Math.max(0, priceInr - costInr);

// Whole rupees, rounded down so the store never over-pays.
export const unitCommission = (priceInr: number, costInr: number, pct: number) => Math.floor((unitProfit(priceInr, costInr) * pct) / 100);

// Everything about one piece, for the admin: what it costs, what is left, what the designer gets and what the store keeps.
export function pieceBreakdown(priceInr: number, vendorInr: number, packagingInr: number, pct: number) {
  const cost = vendorInr + packagingInr;
  const profit = unitProfit(priceInr, cost);
  const commission = unitCommission(priceInr, cost, pct);
  return { cost, profit, commission, keep: profit - commission };
}

// The share to lock onto an order item. A product's own rate wins over the designer's; no designer, or no rate yet, means no share.
export function designerSnapshot(terms: ProductTerms | undefined, designerRate: number | null | undefined, priceInr: number): OrderItem["designer"] {
  if (!terms?.designer_id) return undefined;
  const pct = terms.commission_pct ?? designerRate;
  if (pct === null || pct === undefined) return undefined;
  return { id: terms.designer_id, productId: terms.product_id, costInr: terms.cost_inr, pct, unitCommissionInr: unitCommission(priceInr, terms.cost_inr, pct) };
}

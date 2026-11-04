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

// The share to lock onto an order item; undefined for products with no designer.
export function designerSnapshot(terms: ProductTerms | undefined, priceInr: number): OrderItem["designer"] {
  if (!terms?.designer_id) return undefined;
  return {
    id: terms.designer_id,
    costInr: terms.cost_inr,
    pct: terms.commission_pct,
    unitCommissionInr: unitCommission(priceInr, terms.cost_inr, terms.commission_pct),
  };
}

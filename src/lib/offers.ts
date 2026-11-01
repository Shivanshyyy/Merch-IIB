// Client-safe pricing rules shared by the cart, checkout and the server (which is the one that counts).
import type { Offers } from "@/config/site";
import { inr } from "@/lib/format";

type Priceable = { price_inr: number; name_fee_inr: number };
export type ProductKind = "hoodie" | "tee";
export type Discount = { percent: number; amount: number; label: string };

export const unitPrice = (p: Priceable, name: string) => p.price_inr + (name ? p.name_fee_inr : 0);

// Hoodie + tee combo or a big order: only the bigger of the two applies.
export function bestDiscount(lines: { kind: ProductKind | undefined; amount: number }[], o: Offers): Discount | null {
  const subtotal = lines.reduce((n, l) => n + l.amount, 0);
  const options: { percent: number; label: string }[] = [];
  if (o.comboPercent > 0 && lines.some((l) => l.kind === "hoodie") && lines.some((l) => l.kind === "tee")) options.push({ percent: o.comboPercent, label: `Hoodie + T-shirt combo · ${o.comboPercent}% off` });
  if (o.bulkPercent > 0 && subtotal > o.bulkAbove) options.push({ percent: o.bulkPercent, label: `Order above ${inr(o.bulkAbove)} · ${o.bulkPercent}% off` });
  const best = options.sort((a, b) => b.percent - a.percent)[0];
  if (!best) return null;
  const amount = Math.round((subtotal * best.percent) / 100);
  return amount > 0 ? { ...best, amount } : null;
}

// A nudge toward the big-order discount, while it would beat what the cart already gets.
export function offerHint(subtotal: number, current: Discount | null, o: Offers): string | null {
  if (o.bulkPercent <= 0 || subtotal > o.bulkAbove || (current && current.percent >= o.bulkPercent)) return null;
  return `Add ${inr(o.bulkAbove + 1 - subtotal)} more to get ${o.bulkPercent}% off`;
}

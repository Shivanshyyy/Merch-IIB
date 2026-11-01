// Client-safe view of the freebies offer.
import type { Promo } from "@/config/site";

export type PromoView = { title: string; items: string[]; note: string; limit: number; left: number };

// null when the offer is off. `taken` is null when the count couldn't be read (the counter is hidden then).
export function promoView(promo: Promo, taken: number | null): PromoView | null {
  if (!promo.enabled) return null;
  const left = taken === null ? promo.limit : Math.max(0, promo.limit - taken);
  return { title: promo.title, items: promo.items, note: promo.note, limit: promo.limit, left };
}

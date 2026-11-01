// Client-safe. A product is on sale when its original price is above the selling price.
type Priced = { price_inr: number; compare_at_inr: number | null };

export const isOnSale = (p: Priced): p is Priced & { compare_at_inr: number } => p.compare_at_inr !== null && p.compare_at_inr > p.price_inr;

export const discountPercent = (p: Priced) => (isOnSale(p) ? Math.round((1 - p.price_inr / p.compare_at_inr) * 100) : 0);

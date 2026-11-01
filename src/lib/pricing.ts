import "server-only";
import type { Offers } from "@/config/site";
import { bestDiscount, unitPrice, type Discount } from "@/lib/offers";
import { makeCartLineSchema, type CartLineInput, type NameRules } from "@/lib/schemas";
import type { OrderItem, Product } from "@/lib/types";

type Priced = { ok: true; items: OrderItem[]; subtotal: number; discount: Discount | null; total: number } | { ok: false; message: string };

// Prices come only from `products`; anything price-like in the request is ignored.
export function priceOrder(lines: CartLineInput[], products: Product[], rules: NameRules & { offers: Offers }): Priced {
  const schema = makeCartLineSchema(rules);
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const items: OrderItem[] = [];
  const amounts: { kind: Product["type"]; amount: number }[] = [];

  for (const raw of lines) {
    const line = schema.parse(raw);
    const product = bySlug.get(line.slug);
    if (!product) return { ok: false, message: "An item in your cart is no longer available. Please remove it and try again." };
    if (!product.colorways.some((c) => c.name === line.colorway)) return { ok: false, message: `${product.name} is no longer available in ${line.colorway}.` };
    if (!product.sizes.includes(line.size)) return { ok: false, message: `${product.name} is no longer available in size ${line.size}.` };
    if (line.name && !product.personalizable) return { ok: false, message: `${product.name} can't be personalised.` };

    const unit = unitPrice(product, line.name);
    const fee = line.name ? product.name_fee_inr : 0;
    items.push({ slug: product.slug, productName: product.name, colorway: line.colorway, size: line.size, name: line.name, qty: line.qty, unitPriceInr: unit, ...(fee ? { nameFeeInr: fee } : {}) });
    amounts.push({ kind: product.type, amount: unit * line.qty });
  }
  const subtotal = amounts.reduce((n, a) => n + a.amount, 0);
  const discount = bestDiscount(amounts, rules.offers);
  return { ok: true, items, subtotal, discount, total: subtotal - (discount?.amount ?? 0) };
}

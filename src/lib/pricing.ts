import "server-only";
import { makeCartLineSchema, type CartLineInput, type NameRules } from "@/lib/schemas";
import type { OrderItem, Product } from "@/lib/types";

type Priced = { ok: true; items: OrderItem[]; total: number } | { ok: false; message: string };

// Prices come only from `products`; anything price-like in the request is ignored.
export function priceOrder(lines: CartLineInput[], products: Product[], rules: NameRules): Priced {
  const schema = makeCartLineSchema(rules);
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const items: OrderItem[] = [];
  let total = 0;

  for (const raw of lines) {
    const line = schema.parse(raw);
    const product = bySlug.get(line.slug);
    if (!product) return { ok: false, message: "An item in your cart is no longer available. Please remove it and try again." };
    if (!product.colorways.some((c) => c.name === line.colorway)) return { ok: false, message: `${product.name} is no longer available in ${line.colorway}.` };
    if (!product.sizes.includes(line.size)) return { ok: false, message: `${product.name} is no longer available in size ${line.size}.` };
    if (line.name && !product.personalizable) return { ok: false, message: `${product.name} can't be personalised.` };

    items.push({ slug: product.slug, productName: product.name, colorway: line.colorway, size: line.size, name: line.name, qty: line.qty, unitPriceInr: product.price_inr });
    total += product.price_inr * line.qty;
  }
  return { ok: true, items, total };
}

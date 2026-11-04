import "server-only";
import { designerSnapshot } from "@/lib/designer/commission";
import type { Db } from "@/lib/db/types";
import type { OrderItem, Product } from "@/lib/types";

// Looks up, once per order, which products belong to a designer and at what rate, so pricing can lock the share onto each item.
export async function shareResolver(d: Db): Promise<(product: Product) => OrderItem["designer"]> {
  const terms = (await d.listProductTerms()).filter((t) => t.designer_id);
  if (terms.length === 0) return () => undefined;
  const rates = new Map((await d.listDesigners()).map((x) => [x.id, x.commission_pct]));
  const byProduct = new Map(terms.map((t) => [t.product_id, t]));
  return (product) => {
    const t = byProduct.get(product.id);
    return designerSnapshot(t, t?.designer_id ? rates.get(t.designer_id) : null, product.price_inr);
  };
}

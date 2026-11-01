import { discountPercent, isOnSale } from "@/lib/discount";
import { inr } from "@/lib/format";

type Props = { product: { price_inr: number; compare_at_inr: number | null }; qty?: number; className?: string; badge?: boolean };

// Selling price, plus the original crossed out and the % off when the product is discounted.
export function Price({ product, qty = 1, className = "text-lg", badge = true }: Props) {
  const sale = isOnSale(product);
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <span className={`mono ${className} ${sale ? "text-accent-2" : ""}`}>{inr(product.price_inr * qty)}</span>
      {sale && (
        <>
          <s className="mono text-[0.8em] text-muted decoration-accent/80" aria-label={`was ${inr(product.compare_at_inr * qty)}`}>
            {inr(product.compare_at_inr * qty)}
          </s>
          {badge && <span className="label bg-accent px-1.5 py-1 leading-none text-bg">{discountPercent(product)}% off</span>}
        </>
      )}
    </span>
  );
}

"use client";

import { useSettings } from "@/components/SettingsProvider";
import { inr } from "@/lib/format";
import { bestDiscount, offerHint } from "@/lib/offers";
import { cartSubtotal, type CartLine } from "@/store/cart";

// The cart's estimated offer (hoodie + tee combo, or big-order %), plus a nudge toward the bigger one. Checkout confirms it.
export function useCartOffer(lines: CartLine[]) {
  const { offers } = useSettings();
  const subtotal = cartSubtotal(lines);
  const discount = bestDiscount(lines.map((l) => ({ kind: l.productType, amount: l.unitPriceInr * l.qty })), offers);
  return { subtotal, discount, total: subtotal - (discount?.amount ?? 0), hint: offerHint(subtotal, discount, offers) };
}

export function CartOffer({ lines, size = "text-2xl" }: { lines: CartLine[]; size?: string }) {
  const { subtotal, discount, total, hint } = useCartOffer(lines);
  return (
    <div className="mono grid gap-2 text-[0.9rem]">
      {discount && (
        <>
          <div className="flex justify-between">
            <span className="text-muted">Subtotal</span>
            <span>{inr(subtotal)}</span>
          </div>
          <div className="flex justify-between gap-4 text-accent-2">
            <span>{discount.label}</span>
            <span className="shrink-0">−{inr(discount.amount)}</span>
          </div>
        </>
      )}
      <div className="flex items-baseline justify-between">
        <span className="label">{discount ? "Total" : "Subtotal"}</span>
        <span className={size}>{inr(total)}</span>
      </div>
      {hint && <p className="label normal-case tracking-normal text-accent-2">✦ {hint}</p>}
    </div>
  );
}

"use client";

import { CartLineRow } from "@/components/cart/CartLineRow";
import { EmptyHanger } from "@/components/cart/CartDrawer";
import { Button } from "@/components/ui/Button";
import { inr } from "@/lib/format";
import { cartCount, cartSubtotal, useCart } from "@/store/cart";

export function CartView() {
  const lines = useCart((s) => s.lines);
  const hydrated = useCart((s) => s.hydrated);

  if (!hydrated) {
    return (
      <div className="mt-12 grid gap-px" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="skeleton h-36" />
        ))}
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mt-12 flex flex-col items-center gap-8 border border-dashed border-line px-6 py-20 text-center">
        <EmptyHanger />
        <div>
          <p className="t-display text-2xl">Your cart is empty</p>
          <p className="mx-auto mt-3 max-w-sm text-muted">Pick a hoodie, add your name, and it lands here. Nothing is charged until you pay by UPI.</p>
        </div>
        <Button href="/shop" size="lg">
          Browse the drop
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
      <ul className="border-t border-line">
        {lines.map((l) => (
          <CartLineRow key={l.id} line={l} />
        ))}
      </ul>
      <aside className="h-fit border border-line bg-bg-2 p-6 lg:sticky lg:top-[calc(var(--nav-h)+24px)]">
        <p className="label">[ Summary ]</p>
        <dl className="mono mt-6 grid gap-3 text-[0.9rem]">
          <div className="flex justify-between">
            <dt className="text-muted">Items</dt>
            <dd>{cartCount(lines)}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-line pt-4">
            <dt className="text-muted">Subtotal</dt>
            <dd className="text-2xl">{inr(cartSubtotal(lines))}</dd>
          </div>
        </dl>
        <p className="label mt-5 normal-case leading-relaxed tracking-normal">Made to order. Double-check name spelling. The final total is confirmed at checkout.</p>
        <Button href="/checkout" size="lg" block className="mt-6">
          Checkout
        </Button>
      </aside>
    </div>
  );
}

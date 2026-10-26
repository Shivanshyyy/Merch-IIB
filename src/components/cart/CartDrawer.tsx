"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRef } from "react";
import { CartLineRow } from "@/components/cart/CartLineRow";
import { Button } from "@/components/ui/Button";
import { useFocusTrap } from "@/components/ui/useFocusTrap";
import { inr } from "@/lib/format";
import { cartSubtotal, useCart } from "@/store/cart";

export function CartDrawer() {
  const open = useCart((s) => s.drawerOpen);
  const close = useCart((s) => s.closeDrawer);
  const lines = useCart((s) => s.lines);
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel, open, close);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[110]">
          <motion.div className="absolute inset-0 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} aria-hidden />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Your cart"
            className="absolute right-0 top-0 flex h-full w-full max-w-[460px] flex-col border-l border-line bg-bg"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
              <p className="label text-fg">[ Cart ] — {lines.length} {lines.length === 1 ? "item" : "items"}</p>
              <button type="button" data-autofocus onClick={close} className="label flex min-h-11 items-center whitespace-nowrap px-2 hover:text-fg" aria-label="Close cart">
                Close ✕
              </button>
            </div>

            {lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
                <EmptyHanger />
                <div>
                  <p className="t-display text-xl">Nothing here yet</p>
                  <p className="mt-2 text-muted">Your next hoodie is waiting on the rail.</p>
                </div>
                <Button href="/shop" onClick={close}>
                  Browse the drop
                </Button>
              </div>
            ) : (
              <>
                <ul className="flex-1 overflow-y-auto px-5">
                  {lines.map((l) => (
                    <CartLineRow key={l.id} line={l} compact />
                  ))}
                </ul>
                <div className="shrink-0 border-t border-line bg-bg-2 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                  <p className="label mb-4 normal-case tracking-normal">Made to order. Double-check name spelling.</p>
                  <div className="mb-5 flex items-baseline justify-between">
                    <span className="label">Subtotal</span>
                    <span className="mono text-2xl">{inr(cartSubtotal(lines))}</span>
                  </div>
                  <div className="grid gap-3">
                    <Button href="/checkout" block size="lg" onClick={close}>
                      Checkout
                    </Button>
                    <Button href="/cart" block variant="ghost" onClick={close}>
                      View full cart
                    </Button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function EmptyHanger() {
  return (
    <svg width="120" height="96" viewBox="0 0 120 96" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden className="text-muted">
      <path d="M60 14c0-6 6-9 10-6s2 11-6 14l-4 3" strokeLinecap="round" />
      <path d="M60 25 12 62c-4 3-2 9 3 9h90c5 0 7-6 3-9L60 25Z" strokeLinejoin="round" />
      <path d="M30 71v14M90 71v14" strokeDasharray="2 5" strokeLinecap="round" />
    </svg>
  );
}

"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { site } from "@/config/site";

// Display snapshot only. The server re-prices every line from the database at checkout.
export type CartLine = {
  id: string;
  slug: string;
  productName: string;
  colorway: string;
  colorwayBody: string;
  size: string;
  name: string;
  qty: number;
  unitPriceInr: number;
  productType?: "hoodie" | "tee"; // missing on lines saved before tees existed
};

type CartState = {
  lines: CartLine[];
  hydrated: boolean;
  drawerOpen: boolean;
  bumps: number;
  add: (line: Omit<CartLine, "id">) => void;
  replace: (id: string, line: Omit<CartLine, "id">) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  bump: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const clampQty = (n: number) => Math.min(site.maxQtyPerLine, Math.max(1, Math.round(n)));
const same = (a: Omit<CartLine, "id">, b: Omit<CartLine, "id">) => a.slug === b.slug && a.colorway === b.colorway && a.size === b.size && a.name === b.name;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      hydrated: false,
      drawerOpen: false,
      bumps: 0,
      add: (line) =>
        set((s) => {
          const hit = s.lines.find((l) => same(l, line));
          const lines = hit
            ? s.lines.map((l) => (l === hit ? { ...l, qty: clampQty(l.qty + line.qty) } : l))
            : [...s.lines, { ...line, qty: clampQty(line.qty), id: crypto.randomUUID() }];
          return { lines };
        }),
      replace: (id, line) => set((s) => ({ lines: s.lines.map((l) => (l.id === id ? { ...line, qty: clampQty(line.qty), id } : l)) })),
      setQty: (id, qty) => set((s) => ({ lines: s.lines.map((l) => (l.id === id ? { ...l, qty: clampQty(qty) } : l)) })),
      remove: (id) => set((s) => ({ lines: s.lines.filter((l) => l.id !== id) })),
      clear: () => set({ lines: [] }),
      bump: () => set((s) => ({ bumps: s.bumps + 1 })), // the badge nudge, once the thumbnail has landed
      openDrawer: () => set({ drawerOpen: true }),
      closeDrawer: () => set({ drawerOpen: false }),
    }),
    {
      name: "merch-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lines: s.lines }),
      // Hydrate after mount so the first client render matches the server HTML.
      skipHydration: true,
      onRehydrateStorage: () => () => useCart.setState({ hydrated: true }),
    },
  ),
);

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty, 0);
export const cartSubtotal = (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty * l.unitPriceInr, 0);

export function useCartHydration() {
  useEffect(() => {
    void useCart.persist.rehydrate();
  }, []);
}

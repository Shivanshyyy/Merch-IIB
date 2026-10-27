"use client";

import { create } from "zustand";
import { useCart } from "@/store/cart";

type Rect = { x: number; y: number; w: number; h: number };
export type Flight = { id: number; from: Rect; to: { x: number; y: number }; src: string; body: string; qty: number };

type FlyState = {
  flights: Flight[];
  inflight: number; // items still in the air: the cart badge doesn't count them until they land
  launch: (f: Omit<Flight, "id">) => void;
  land: (id: number) => void;
};

let next = 0;

export const useFly = create<FlyState>((set, get) => ({
  flights: [],
  inflight: 0,
  launch: (f) => set((s) => ({ flights: [...s.flights, { ...f, id: ++next }], inflight: s.inflight + f.qty })),
  land: (id) => {
    const f = get().flights.find((x) => x.id === id);
    if (!f) return;
    set((s) => ({ flights: s.flights.filter((x) => x.id !== id), inflight: Math.max(0, s.inflight - f.qty) }));
    useCart.getState().bump();
  },
}));

// Sends a thumbnail from `from` (the product picture) to the cart button. Without a cart button on screen, or with
// reduced motion, it just bumps the badge.
export function flyToCart(from: DOMRect | null, o: { src: string; body: string; qty: number }) {
  const target = document.querySelector("[data-cart-target]")?.getBoundingClientRect();
  if (!from || !target || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    useCart.getState().bump();
    return;
  }
  const size = Math.min(from.width, from.height, 140);
  useFly.getState().launch({
    from: { x: from.left + from.width / 2 - size / 2, y: from.top + from.height / 2 - size / 2, w: size, h: size },
    to: { x: target.left + target.width / 2, y: target.top + target.height / 2 },
    ...o,
  });
}

"use client";

import { create } from "zustand";

export type HomeColorway = { name: string; body: string; stitch: string; slug: string };

// What the visitor has picked on the home page.
type HomeState = {
  colorway: HomeColorway | null;
  name: string;
  setColorway: (c: HomeColorway) => void;
  setName: (n: string) => void;
};

export const useHome = create<HomeState>((set) => ({
  colorway: null,
  name: "",
  setColorway: (colorway) => set({ colorway }),
  setName: (name) => set({ name }),
}));

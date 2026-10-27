"use client";

import { create } from "zustand";

export type HomeColorway = { name: string; body: string; stitch: string; slug: string };

// Shared by the HTML sections and the 3D scene: what is chosen, and where the visitor is on the page.
type HomeState = {
  colorway: HomeColorway | null;
  name: string;
  section: number; // 0..6, the section most in view
  shot: string; // the camera shot that section uses
  mode: "poster" | "webgl"; // poster = static render (reduced motion, no WebGL, before the scene is ready)
  sceneReady: boolean; // first 3D frame drawn: the poster can fade out
  quality: "high" | "low";
  setColorway: (c: HomeColorway) => void;
  setName: (n: string) => void;
  setSection: (i: number, shot: string) => void;
  setMode: (m: "poster" | "webgl") => void;
  setSceneReady: () => void;
  setQuality: (q: "high" | "low") => void;
};

export const useHome = create<HomeState>((set) => ({
  colorway: null,
  name: "",
  section: 0,
  shot: "hero",
  mode: "poster",
  sceneReady: false,
  quality: "high",
  setColorway: (colorway) => set({ colorway }),
  setName: (name) => set({ name }),
  setSection: (section, shot) => set({ section, shot }),
  setMode: (mode) => set({ mode }),
  setSceneReady: () => set({ sceneReady: true }),
  setQuality: (quality) => set({ quality }),
}));

"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { prefersReducedMotion, webglAvailable } from "@/lib/webgl";
import { Poster } from "./Poster";
import { Preloader } from "./Preloader";
import { Sections, type HomeBatch } from "./Sections";
import { useHome, type HomeColorway } from "./store";

// Heavy (three.js, R3F, GSAP): fetched only on the home page, only in the browser, only when 3D is allowed.
const SceneRoot = dynamic(() => import("./scene/SceneRoot"), { ssr: false });

export function HomeExperience({ colorways, batch }: { colorways: HomeColorway[]; batch: HomeBatch }) {
  const mode = useHome((s) => s.mode);
  const posterReady = useHome((s) => s.posterReady);

  // Choose 3D or the static poster, and keep choosing if the visitor changes their motion preference.
  useEffect(() => {
    const { setMode, setColorway, colorway } = useHome.getState();
    if (!colorway && colorways[0]) setColorway(colorways[0]);
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const decide = () => setMode(!prefersReducedMotion() && webglAvailable() ? "webgl" : "poster");
    decide();
    const patience = window.setTimeout(() => useHome.getState().setPosterReady(), 3000); // a stuck image must not hold the scene back
    query.addEventListener("change", decide);
    return () => {
      clearTimeout(patience);
      query.removeEventListener("change", decide);
    };
  }, [colorways]);

  // Which section is in view: drives callouts, the poster's front/back view and the camera shot.
  useEffect(() => {
    let raf = 0;
    const pick = () => {
      raf = 0;
      const mid = innerHeight / 2;
      let best: HTMLElement | null = null;
      let bestD = Infinity;
      for (const el of document.querySelectorAll<HTMLElement>("[data-home-root] [data-section]")) {
        const r = el.getBoundingClientRect();
        const d = Math.abs((r.top + r.bottom) / 2 - mid);
        if (r.top < mid && r.bottom > mid && d < bestD) {
          best = el;
          bestD = d;
        }
      }
      if (best) {
        const { section, shot, setSection } = useHome.getState();
        const i = Number(best.dataset.section);
        const sh = best.dataset.shot ?? "hero";
        if (i !== section || sh !== shot) setSection(i, sh);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(pick);
    };
    pick();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <Preloader batch={batch} />
      <Poster />
      {mode === "webgl" && posterReady && <SceneRoot />}
      <Sections colorways={colorways} batch={batch} />
    </>
  );
}

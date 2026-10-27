"use client";

import Lenis from "lenis";
import { useEffect } from "react";
import { setLenis } from "@/lib/smooth-scroll";
import { prefersReducedMotion } from "@/lib/webgl";

// Inertial wheel scrolling on every customer page. Touch keeps the browser's own scrolling, and reduced motion keeps all of it.
export function SmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    setLenis(lenis);
    let raf = requestAnimationFrame(function loop(t) {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    });
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      setLenis(null);
    };
  }, []);
  return null;
}

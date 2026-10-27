import type Lenis from "lenis";

// The page's smooth-scroll instance: null with reduced motion, and before it starts.
let instance: Lenis | null = null;
export const getLenis = () => instance;
export const setLenis = (l: Lenis | null) => {
  instance = l;
};

// Freezes page scrolling while an overlay is open: the CSS lock stops native scrolling, stop() stops Lenis.
export function lockScroll(): () => void {
  const html = document.documentElement;
  const previous = html.style.overflow;
  html.style.overflow = "hidden";
  instance?.stop();
  return () => {
    html.style.overflow = previous;
    instance?.start();
  };
}

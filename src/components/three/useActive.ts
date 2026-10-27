"use client";

import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

// True only while a canvas can actually be seen: this tab is visible, the router hasn't hidden the page (Cache Components
// keeps pages you leave alive, hidden), and, if an element is given, it is on screen. A hidden canvas stops rendering.
export function useActive(target?: RefObject<Element | null>) {
  const [route, setRoute] = useState(true);
  const [tab, setTab] = useState(true);
  const [onScreen, setOnScreen] = useState(true);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setRoute(true)); // shown again: resume next frame
    return () => {
      cancelAnimationFrame(id);
      setRoute(false);
    };
  }, []);

  useEffect(() => {
    const on = () => setTab(!document.hidden);
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  useEffect(() => {
    const el = target?.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, [target]);

  return route && tab && onScreen;
}

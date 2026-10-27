"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { prefersReducedMotion, webglAvailable } from "@/lib/webgl";

// three.js loads on the first hover, not with the page.
const TurntableCanvas = dynamic(() => import("@/components/three/TurntableCanvas"), { ssr: false });

type Hovered = { card: HTMLElement; stage: HTMLElement };

// Checked once: probing WebGL creates a context, so it must not run on every render.
let capableCache: boolean | undefined;
const canTurn = () => (capableCache ??= matchMedia("(hover: hover) and (pointer: fine)").matches && !prefersReducedMotion() && webglAvailable());
const noSubscription = () => () => {};

// One shared canvas for the whole shop grid. Hover a card and the still cross-fades into a slow 360° turn of the live
// model in that card's colours. Mouse and WebGL only: touch screens and reduced motion keep the plain still.
export function ShopTurntable() {
  const capable = useSyncExternalStore(noSubscription, canTurn, () => false);
  const [started, setStarted] = useState(false); // first hover happened: load the canvas
  const [ready, setReady] = useState(false);
  const [colours, setColours] = useState({ body: "#0e0e10", stitch: "#e01e0a" });
  const [active, setActive] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const hovered = useRef<Hovered | null>(null);
  const readyRef = useRef(false);

  const onReady = useCallback(() => {
    readyRef.current = true;
    setReady(true);
    if (hovered.current) hovered.current.card.dataset.tt = "ready";
  }, []);

  useEffect(() => {
    if (!capable) return;
    const html = document.documentElement;
    html.classList.add("turntable");

    const leave = () => {
      const h = hovered.current;
      if (!h) return;
      delete h.card.dataset.tt;
      hovered.current = null;
      if (box.current) box.current.dataset.on = "false";
      setActive(false);
    };
    const enter = (card: HTMLElement) => {
      const stage = card.querySelector<HTMLElement>("[data-turntable-stage]");
      if (!stage) return;
      hovered.current = { card, stage };
      setColours({ body: card.dataset.body ?? "#0e0e10", stitch: card.dataset.stitch ?? "#e01e0a" });
      setStarted(true);
      setActive(true);
      if (readyRef.current) {
        card.dataset.tt = "ready";
        if (box.current) box.current.dataset.on = "true";
      }
    };
    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const card = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-turntable]") : null;
      if (card === hovered.current?.card) return;
      leave();
      if (card) enter(card);
    };
    document.addEventListener("pointerover", onOver);

    // Keep the shared canvas on the hovered card's picture, including while the page scrolls under the pointer.
    let raf = 0;
    let last = "";
    const follow = () => {
      const h = hovered.current;
      const b = box.current;
      if (h && b) {
        const r = h.stage.getBoundingClientRect();
        const key = `${r.left}|${r.top}|${r.width}|${r.height}`;
        if (key !== last) {
          last = key;
          b.style.transform = `translate3d(${r.left}px,${r.top}px,0)`;
          b.style.width = `${r.width}px`;
          b.style.height = `${r.height}px`;
        }
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("pointerover", onOver);
      leave();
      html.classList.remove("turntable");
    };
  }, [capable]);

  // The ready signal arrives after the colours of the first hovered card were set; show it then.
  useEffect(() => {
    if (ready && hovered.current && box.current) box.current.dataset.on = "true";
  }, [ready]);

  if (!capable) return null;
  return (
    <div ref={box} aria-hidden className="turntable-box" data-on="false">
      {started && <TurntableCanvas body={colours.body} stitch={colours.stitch} active={active} onReady={onReady} />}
    </div>
  );
}

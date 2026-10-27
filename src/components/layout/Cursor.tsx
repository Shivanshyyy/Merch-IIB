"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/webgl";

type Kind = "idle" | "link" | "view" | "drag" | "text";

const TEXTY = "input, textarea, select, [contenteditable='true']";
const CLICKY = "a[href], button, [role='button'], [role='radio'], summary, label";
const MAGNETIC = ".btn:not(.btn-ghost):not(.btn-quiet):not(:disabled):not([aria-disabled='true'])";

// What the pointer is over decides the shape: DRAG over the 3D, VIEW over product cards, a bigger dot over links,
// the normal text cursor over form fields.
function kindOf(target: EventTarget | null): Kind {
  const el = target instanceof Element ? target : null;
  if (!el) return "idle";
  if (el.closest(TEXTY)) return "text";
  const tagged = el.closest<HTMLElement>("[data-cursor]")?.dataset.cursor;
  if (tagged === "view" || tagged === "drag") return tagged;
  if (el.closest(CLICKY)) return "link";
  return "idle";
}

// A dot that follows the pointer, a ring that trails it, and primary buttons that lean toward it. Desktop mice only.
export function Cursor() {
  const root = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches || prefersReducedMotion()) return;
    const el = root.current;
    const d = dot.current;
    const r = ring.current;
    const text = label.current;
    if (!el || !d || !r || !text) return;
    const html = document.documentElement;

    const p = { x: 0, y: 0, rx: 0, ry: 0 };
    let raf = 0;
    let shown = false;
    let kind: Kind = "idle";
    let magnet: HTMLElement | null = null;

    const frame = () => {
      p.rx += (p.x - p.rx) * 0.2;
      p.ry += (p.y - p.ry) * 0.2;
      d.style.transform = `translate3d(${p.x}px,${p.y}px,0)`;
      r.style.transform = `translate3d(${p.rx}px,${p.ry}px,0)`;
      raf = Math.abs(p.x - p.rx) > 0.1 || Math.abs(p.y - p.ry) > 0.1 ? requestAnimationFrame(frame) : 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const release = () => {
      if (magnet) magnet.style.translate = "";
      magnet = null;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (!shown) {
        shown = true;
        p.rx = p.x;
        p.ry = p.y;
        html.classList.add("has-cursor");
        el.dataset.hidden = "false";
      }
      const next = kindOf(e.target);
      if (next !== kind) {
        kind = next;
        el.dataset.kind = next;
        el.dataset.hidden = String(next === "text"); // the I-beam is better than a dot over a text field
        text.textContent = next === "view" ? "VIEW" : next === "drag" ? "DRAG" : "";
      }

      // Primary buttons lean toward the pointer while it is over them.
      const target = e.target instanceof Element ? e.target.closest<HTMLElement>(MAGNETIC) : null;
      if (target !== magnet) release();
      if (target) {
        magnet = target;
        const b = target.getBoundingClientRect();
        const dx = Math.max(-1, Math.min(1, (e.clientX - (b.left + b.width / 2)) / (b.width / 2)));
        const dy = Math.max(-1, Math.min(1, (e.clientY - (b.top + b.height / 2)) / (b.height / 2)));
        target.style.translate = `${(dx * 7).toFixed(1)}px ${(dy * 5).toFixed(1)}px`;
      }
      kick();
    };
    const onDown = () => (el.dataset.down = "true");
    const onUp = () => (el.dataset.down = "false");
    const onLeave = () => {
      shown = false;
      html.classList.remove("has-cursor");
      release();
    };

    el.dataset.kind = "idle";
    el.dataset.hidden = "true";
    addEventListener("pointermove", onMove, { passive: true });
    addEventListener("pointerdown", onDown);
    addEventListener("pointerup", onUp);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerdown", onDown);
      removeEventListener("pointerup", onUp);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
      release();
      html.classList.remove("has-cursor");
    };
  }, []);

  return (
    <div ref={root} aria-hidden className="cursor">
      <div ref={ring} className="cursor-ring">
        <div className="cursor-ring-i">
          <span ref={label} />
        </div>
      </div>
      <div ref={dot} className="cursor-dot">
        <div className="cursor-dot-i" />
      </div>
    </div>
  );
}

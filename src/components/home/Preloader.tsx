"use client";

import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/components/SettingsProvider";
import { HOODIE_BYTES, HOODIE_URL } from "@/lib/model";
import { lockScroll } from "@/lib/smooth-scroll";
import { bootProgress, counterText } from "./boot";
import { useHome } from "./store";

export const BOOT_KEY = "merch-boot";
const GIVE_UP_MS = 25_000; // never hold the page hostage
const SKIP_AFTER_MS = 5_000;

type Props = { batch: { name: string } | null };

// The first thing on the home page: a 000 -> 100 counter driven by the real download of the 3D model and the scene's
// first compiled frame. At 100 it splits along its middle and slides apart to reveal the scene.
export function Preloader({ batch }: Props) {
  const { brand } = useSettings();
  const mode = useHome((s) => s.mode);
  const ready = useHome((s) => s.sceneReady);
  const posterReady = useHome((s) => s.posterReady);
  const boot = useHome((s) => s.boot);
  const setBoot = useHome((s) => s.setBoot);
  const [canSkip, setCanSkip] = useState(false);

  const ui = useRef<HTMLDivElement>(null);
  const counts = useRef<HTMLElement[]>([]);
  const bars = useRef<HTMLElement[]>([]);
  const readyRef = useRef(false);
  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  const finish = () => {
    document.documentElement.classList.add("booted");
    try {
      sessionStorage.setItem(BOOT_KEY, "1");
    } catch {
      /* private mode: it just plays again next visit */
    }
    setBoot("done");
  };

  // Already seen this session (the class is set by an inline script before first paint): nothing to show.
  useEffect(() => {
    if (document.documentElement.classList.contains("booted") && useHome.getState().boot === "pending") setBoot("done");
  }, [setBoot]);

  // Reduced motion or no WebGL: there is no 3D to wait for.
  useEffect(() => {
    if (mode === "poster" && boot === "pending") finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish only touches the store and the document
  }, [mode, boot]);

  useEffect(() => {
    if (mode !== "webgl" || !posterReady || boot !== "pending" || document.documentElement.classList.contains("booted")) return;
    const t0 = performance.now();
    const model = { got: 0, total: HOODIE_BYTES };
    const abort = new AbortController();
    let raf = 0;
    let shown = 0;
    let finishing = false;
    const timers: number[] = [];

    // The real bytes of the model. The browser cache then serves the scene's own request instantly.
    void fetch(HOODIE_URL, { signal: abort.signal })
      .then(async (res) => {
        const length = Number(res.headers.get("content-length"));
        if (length > 0 && !res.headers.get("content-encoding")) model.total = length;
        const reader = res.body?.getReader();
        if (!reader) return;
        for (;;) {
          const { done: end, value } = await reader.read();
          if (end) break;
          model.got += value.length;
        }
        model.got = model.total;
      })
      .catch(() => {});

    const paint = (v: number) => {
      const text = counterText(v);
      for (const c of counts.current) if (c && c.textContent !== text) c.textContent = text;
      for (const b of bars.current) if (b) b.style.transform = `scaleX(${v})`;
    };

    const tick = () => {
      const elapsed = performance.now() - t0;
      const target = bootProgress({ elapsedMs: elapsed, modelBytes: model.got, modelTotal: model.total, ready: readyRef.current });
      shown = Math.max(shown, shown + (target - shown) * (readyRef.current ? 0.28 : 0.1)); // eased, and never backwards
      if (target === 1 && shown > 0.995) shown = 1;
      paint(shown);

      if (!finishing && (shown >= 1 || elapsed > GIVE_UP_MS)) {
        finishing = true;
        ui.current?.setAttribute("data-done", "true");
        timers.push(window.setTimeout(() => useHome.getState().setBoot("leaving"), 450));
      }
      if (!finishing) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    timers.push(window.setTimeout(() => setCanSkip(true), SKIP_AFTER_MS));

    // While it covers the page, nothing behind it can be scrolled or tabbed to.
    const unlock = lockScroll();
    const behind = [...document.querySelectorAll<HTMLElement>("header, footer, [data-home-root]")];
    for (const el of behind) el.setAttribute("inert", "");

    return () => {
      cancelAnimationFrame(raf);
      abort.abort();
      timers.forEach(clearTimeout);
      unlock();
      for (const el of behind) el.removeAttribute("inert");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per boot; progress is read through refs
  }, [mode, posterReady, boot === "pending"]);

  // Once it is splitting apart, remove it when the slide has finished. Its own effect, so the loading effect's cleanup
  // (which runs the moment boot leaves "pending") can't cancel it.
  useEffect(() => {
    if (boot !== "leaving") return;
    const t = window.setTimeout(finish, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish only touches the store and the document
  }, [boot]);

  if (boot === "done") return null;

  const half = (which: "top" | "bottom", i: number) => (
    <div className={`preloader-half preloader-${which}`}>
      <div className="preloader-inner">
        {which === "top" && (
          <div className="shell absolute inset-x-0 top-0 flex justify-between pt-6 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-muted">
            <span>[ {brand} ]</span>
            <span>{batch ? `${batch.name} · preorder` : "Preorder"}</span>
          </div>
        )}
        <div className="preloader-count" ref={(el) => void (el && (counts.current[i] = el))}>
          000
        </div>
        {which === "bottom" && (
          <div className="shell absolute inset-x-0 bottom-0 pb-6">
            <div className="flex justify-between font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-muted">
              <span>Loading the drop</span>
              <span>3D · hoodie · {brand}</span>
            </div>
            <div className="mt-4 h-px bg-line">
              <div className="h-full origin-left bg-accent" style={{ transform: "scaleX(0)" }} ref={(el) => void (el && (bars.current[i] = el))} />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div ref={ui} className="preloader" data-state={boot} aria-busy="true">
      <p className="sr-only" role="status">
        Loading the 3D scene
      </p>
      <div aria-hidden>
        {half("top", 0)}
        {half("bottom", 1)}
      </div>
      {canSkip && boot === "pending" && (
        <button
          type="button"
          onClick={() => useHome.getState().setBoot("leaving")}
          className="label absolute bottom-16 left-1/2 z-10 -translate-x-1/2 border border-line bg-bg px-4 py-3 text-fg hover:border-fg"
        >
          Skip
        </button>
      )}
    </div>
  );
}

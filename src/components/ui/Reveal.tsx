"use client";

import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ElementType } from "react";
import { lineIndexes, revealDelay, splitWords } from "@/lib/reveal";

type Props = {
  children: string; // "\n" starts a new line
  as?: ElementType;
  className?: string;
  id?: string;
  /** load: plays as soon as the page paints (above the fold, no JS needed). view: plays when it scrolls into view. */
  trigger?: "load" | "view";
  /** view only: hold the reveal until this is true (the home hero waits for the preloader). */
  when?: boolean;
  /** Extra seconds before the first word. */
  delay?: number;
};

// A headline whose words slide up out of a mask, line after line.
export function Reveal({ children, as: Tag = "span", className = "", id, trigger = "view", when = true, delay = 0 }: Props) {
  const ref = useRef<HTMLElement>(null);
  const lines = children.split("\n").map(splitWords);
  let n = 0;

  // Stagger by real lines (they depend on the width and the font), so a wrapped headline still cascades top to bottom.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = () => {
      const words = [...el.querySelectorAll<HTMLElement>(".rv-i")];
      const line = lineIndexes(words.map((w) => w.offsetTop));
      const seen: number[] = [];
      words.forEach((w, i) => {
        seen[line[i]] = (seen[line[i]] ?? -1) + 1;
        w.style.setProperty("--d", `${(delay + revealDelay(line[i], seen[line[i]])).toFixed(3)}s`);
      });
    };
    place();
    void document.fonts?.ready.then(place);
  }, [children, delay]);

  useEffect(() => {
    const el = ref.current;
    if (!el || trigger !== "view" || !when || el.hasAttribute("data-in")) return;
    if (typeof IntersectionObserver === "undefined") {
      el.setAttribute("data-in", "");
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.setAttribute("data-in", "");
        io.disconnect();
      },
      { threshold: 0.25, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [trigger, when]);

  return (
    <Tag ref={ref} id={id} className={`rv ${className}`} data-rv={trigger} aria-label={lines.map((l) => l.join(" ")).join(" ")}>
      <span aria-hidden>
        {lines.map((words, li) => (
          <span key={li}>
            {li > 0 && <br />}
            {words.map((w, wi) => (
              <span key={wi}>
                {wi > 0 && " "}
                <span className="rv-w">
                  <span className="rv-i" style={{ "--d": `${(delay + 0.05 * n++).toFixed(2)}s` } as CSSProperties}>
                    {w}
                  </span>
                </span>
              </span>
            ))}
          </span>
        ))}
      </span>
    </Tag>
  );
}

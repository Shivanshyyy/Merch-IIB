"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, type MutableRefObject } from "react";
import { getLenis } from "@/lib/smooth-scroll";
import { shotsFor, type Pose } from "../shots";

const KEYS: (keyof Pose)[] = ["az", "el", "r", "tx", "ty", "tz", "fov", "ox", "oy", "orbit", "spin"];

// The camera choreography: a GSAP timeline, scrubbed by scroll, that tweens the shared pose between each section's shot.
// The pose is a plain object the camera rig reads every frame. Smooth scrolling itself is the site-wide SmoothScroll.
export function ScrollDirector({ pose, onScroll }: { pose: MutableRefObject<Pose>; onScroll: () => void }) {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const onNative = () => onScroll();
    addEventListener("scroll", onNative, { passive: true });
    // Lenis moves the page in its own frame loop; tell ScrollTrigger in the same frame rather than a frame later.
    const offLenis = getLenis()?.on("scroll", ScrollTrigger.update);

    let tl: gsap.core.Timeline | null = null;
    const build = () => {
      tl?.scrollTrigger?.kill();
      tl?.kill();
      const root = document.querySelector<HTMLElement>("[data-home-root]");
      if (!root) return;
      const shots = shotsFor(innerWidth / innerHeight < 0.9);
      const sections = [...root.querySelectorAll<HTMLElement>("[data-shot]")];
      if (!sections.length) return;

      const top = root.getBoundingClientRect().top + scrollY;
      const distance = Math.max(1, root.offsetHeight - innerHeight); // scroll distance the timeline is spread across
      // Each pinned panel is centred on screen midway through its section.
      const centres = sections.map((el) => el.offsetTop + (el.offsetHeight - innerHeight) / 2);
      void top;

      Object.assign(pose.current, shots[sections[0].dataset.shot as keyof typeof shots]);
      tl = gsap.timeline({ scrollTrigger: { trigger: root, start: "top top", end: "bottom bottom", scrub: 0.9, invalidateOnRefresh: true } });
      const HOLD = 0.22; // keep each shot steady for a while before moving on
      for (let i = 0; i < sections.length - 1; i++) {
        const len = centres[i + 1] - centres[i];
        const next = shots[sections[i + 1].dataset.shot as keyof typeof shots];
        const to = Object.fromEntries(KEYS.map((k) => [k, next[k]]));
        tl.to(pose.current, { ...to, ease: "power2.inOut", duration: ((1 - 2 * HOLD) * len) / distance }, (centres[i] + HOLD * len) / distance);
      }
      tl.set({}, {}, 1); // the timeline spans the whole scroll distance
    };

    build();
    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        build();
        ScrollTrigger.refresh();
      }, 200);
    };
    addEventListener("resize", onResize);
    // Images and fonts settle after mount and can move the sections.
    const late = setTimeout(() => ScrollTrigger.refresh(), 800);

    return () => {
      clearTimeout(timer);
      clearTimeout(late);
      removeEventListener("resize", onResize);
      tl?.scrollTrigger?.kill();
      tl?.kill();
      removeEventListener("scroll", onNative);
      offLenis?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- built once; pose and onScroll are stable refs
  }, []);

  return null;
}

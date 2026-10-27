"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/components/SettingsProvider";
import { wipeDestination, wipeLabel } from "@/lib/transition";
import { prefersReducedMotion } from "@/lib/webgl";

// A red wipe between pages: a click on an in-app link covers the screen, the route changes underneath, and the wipe lifts
// off the new page. Back/forward, forms and the admin panel are left alone.
export function PageTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const { brand } = useSettings();
  const [wipe, setWipe] = useState<string | null>(null);
  const target = useRef<string | null>(null);
  const phase = useRef<"idle" | "covering" | "waiting">("idle");
  const failsafe = useRef(0);

  const lift = () => {
    clearTimeout(failsafe.current);
    phase.current = "idle";
    target.current = null;
    setWipe(null);
  };

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const onClick = (e: MouseEvent) => {
      const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!a) return;
      const dest = wipeDestination(e, { href: a.href, target: a.target, download: a.hasAttribute("download") }, { origin: location.origin, pathname: location.pathname });
      if (!dest) return;
      e.preventDefault(); // Next's Link sees this and leaves the navigation to us
      if (phase.current !== "idle") return;
      phase.current = "covering";
      target.current = `${dest.pathname}${dest.search}${dest.hash}`;
      setWipe(wipeLabel(dest.pathname, brand));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [brand]);

  // The new route is in place: lift the wipe.
  useEffect(() => {
    if (phase.current === "waiting") lift();
  }, [pathname]);

  useEffect(() => () => clearTimeout(failsafe.current), []);

  return (
    <AnimatePresence>
      {wipe && (
        <motion.div
          key="wipe"
          aria-hidden
          className="wipe"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "-100%" }}
          transition={{ duration: 0.55, ease: [0.76, 0, 0.24, 1] }}
          onAnimationComplete={() => {
            if (phase.current !== "covering" || !target.current) return;
            phase.current = "waiting";
            router.push(target.current);
            failsafe.current = window.setTimeout(lift, 4000); // never leave the visitor under a red screen
          }}
        >
          <span className="wipe-label">{wipe}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

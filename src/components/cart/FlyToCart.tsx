"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { HoodieGlyph } from "@/components/shop/HoodieGlyph";
import { useFly, type Flight } from "@/store/fly";

function Thumb({ f }: { f: Flight }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="grid size-full place-items-center overflow-hidden border border-line bg-bg-2 shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
      {broken || !f.src ? (
        <HoodieGlyph body={f.body} className="size-4/5" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- already in the browser cache from the product page
        <img src={f.src} alt="" className="size-full object-contain" onError={() => setBroken(true)} />
      )}
    </div>
  );
}

// The thumbnails in flight: each arcs up and over into the cart button, shrinking as it goes, then the badge bumps.
export function FlyToCart() {
  const flights = useFly((s) => s.flights);
  const land = useFly((s) => s.land);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[118]">
      <AnimatePresence>
        {flights.map((f) => (
          <motion.div
            key={f.id}
            data-fly
            className="absolute left-0 top-0"
            style={{ width: f.from.w, height: f.from.h }}
            initial={{ x: f.from.x, y: f.from.y, scale: 1, rotate: 0, opacity: 1 }}
            animate={{
              x: f.to.x - f.from.w / 2,
              y: [f.from.y, Math.min(f.from.y, f.to.y) - 110, f.to.y - f.from.h / 2],
              scale: 0.2,
              rotate: 16,
              opacity: [1, 1, 0.9],
            }}
            transition={{
              duration: 0.85,
              x: { duration: 0.85, ease: [0.5, 0, 0.25, 1] },
              y: { duration: 0.85, times: [0, 0.4, 1], ease: ["easeOut", "easeIn"] },
              scale: { duration: 0.85, ease: [0.5, 0, 0.7, 1] },
            }}
            exit={{ opacity: 0, scale: 0.05, transition: { duration: 0.12 } }}
            onAnimationComplete={() => land(f.id)}
          >
            <Thumb f={f} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

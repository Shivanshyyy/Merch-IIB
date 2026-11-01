"use client";

import { useSecondsLeft } from "@/components/home/Countdown";
import { marqueeParts } from "./marquee-text";

// "PREORDER BATCH 01 · CLOSES IN 03D 14H 22M · PICKUP AT HOSTEL 4 ·" on a loop, with the live countdown of the open batch.
// Screen readers get one plain sentence; the moving copies are decoration.
export function Marquee({ batch, pickup, promo }: { batch: { name: string; closesAt: string } | null; pickup: string; promo?: string | null }) {
  const left = useSecondsLeft(batch?.closesAt);
  const parts = marqueeParts({ batchName: batch?.name ?? null, secondsLeft: left, pickup, promo });
  const line = `${parts.join("  ·  ")}  ·  `;
  return (
    <div className="marquee" role="region" aria-label="Preorder status">
      <p className="sr-only">{parts.join(". ")}.</p>
      <div aria-hidden className="marquee-track">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} suppressHydrationWarning>
            {line}
          </span>
        ))}
      </div>
    </div>
  );
}

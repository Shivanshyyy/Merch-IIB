"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { photoUrl } from "@/lib/photos";

// Admin-uploaded photos: swipe on phones (scroll-snap), dots/arrows to jump.
export function PhotoGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    const n = Math.max(0, Math.min(photos.length - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="absolute inset-0">
      <div
        ref={track}
        onScroll={(e) => setActive(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
        className="flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((id, i) => (
          <div key={id} className="relative size-full shrink-0 snap-center">
            <Image src={photoUrl(id)} alt={`${alt}, photo ${i + 1} of ${photos.length}`} fill priority={i === 0} sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover" />
          </div>
        ))}
      </div>

      {photos.length > 1 && (
        <>
          <button type="button" aria-label="Previous photo" onClick={() => go(active - 1)} disabled={active === 0} className="absolute left-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center border border-line bg-bg/70 backdrop-blur-sm disabled:opacity-30 md:grid">
            ←
          </button>
          <button type="button" aria-label="Next photo" onClick={() => go(active + 1)} disabled={active === photos.length - 1} className="absolute right-3 top-1/2 hidden size-11 -translate-y-1/2 place-items-center border border-line bg-bg/70 backdrop-blur-sm disabled:opacity-30 md:grid">
            →
          </button>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
            {photos.map((id, i) => (
              <button key={id} type="button" aria-label={`Photo ${i + 1}`} aria-current={i === active || undefined} onClick={() => go(i)} className="grid size-6 place-items-center">
                <span className={`block h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-fg" : "w-1.5 bg-fg/40"}`} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

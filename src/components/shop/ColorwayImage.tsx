"use client";

import Image from "next/image";
import { useState } from "react";
import { colorwayImage, type StillView } from "@/lib/format";
import { HoodieGlyph } from "./HoodieGlyph";

type Props = { slug: string; colorway: string; body: string; stitch?: string; view?: StillView; alt: string; sizes: string; priority?: boolean; className?: string };

// The studio render for a colourway, or a tinted hoodie glyph when there isn't one yet. Fills its (relative) parent.
export function ColorwayImage({ slug, colorway, body, stitch, view = "front", alt, sizes, priority, className = "object-contain" }: Props) {
  const src = colorwayImage(slug, colorway, view);
  const [failed, setFailed] = useState<string | null>(null);

  if (failed === src) {
    return (
      <div data-fallback="glyph" className="absolute inset-0 grid place-items-center p-[12%]" role="img" aria-label={alt}>
        <HoodieGlyph body={body} stitch={stitch} className="size-full drop-shadow-[0_10px_24px_rgba(0,0,0,0.55)]" />
      </div>
    );
  }
  return <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className={className} onError={() => setFailed(src)} />;
}

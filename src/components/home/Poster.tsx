"use client";

import Image from "next/image";
import { useState } from "react";
import { useSettings } from "@/components/SettingsProvider";
import { colorwayImage } from "@/lib/format";
import { normalizeName } from "@/lib/schemas";
import { useHome } from "./store";

const FALLBACK = "/products/midnight-flame-midnight-front.webp";

// The static render of the hoodie: what loads first, and what stays for reduced motion or when WebGL is missing.
// It follows the same choices as the 3D scene (colour, name, front/back), so every section still works.
export function Poster() {
  const { colorway, name, shot, mode, sceneReady, setPosterReady } = useHome();
  const settings = useSettings();
  const [broken, setBroken] = useState<string | null>(null);

  const view = shot === "back" || shot === "hood" ? "back" : "front";
  const src = colorway ? colorwayImage(colorway.slug, colorway.name, view) : FALLBACK;
  const shown = broken === src ? FALLBACK : src; // a colourway added in admin has no studio photo yet
  const printed = normalizeName(name, settings);
  const hidden = mode === "webgl" && sceneReady;

  return (
    <div aria-hidden={hidden || undefined} className={`pointer-events-none fixed inset-0 z-0 overflow-hidden transition-opacity duration-1000 ${hidden ? "opacity-0" : "opacity-100"}`}>
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_62%_46%,rgba(255,59,31,0.45),transparent_70%),radial-gradient(40%_30%_at_20%_100%,rgba(255,181,71,0.08),transparent_70%)]" />
      <div className="absolute right-[-12vw] top-[12svh] aspect-square w-[118vw] max-w-[1000px] [container-type:inline-size] md:right-[2vw] md:top-[8svh] md:w-[56vw]">
        <Image src={shown} alt={colorway ? `${colorway.name} hoodie, ${view} view` : "A black hoodie with a red emblem on the chest"} fill priority sizes="(min-width: 768px) 56vw, 118vw" className="object-contain" onLoad={setPosterReady} onError={() => { setBroken(src); setPosterReady(); }} />
        {view === "back" && printed && (
          <p
            className="t-display absolute left-1/2 top-[35.5%] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap"
            style={{ color: colorway?.stitch, fontSize: `min(4.6cqw, calc(30cqw / ${Math.max(printed.length * 0.9, 6)}))`, letterSpacing: "0.06em" }}
          >
            {printed}
          </p>
        )}
      </div>
    </div>
  );
}

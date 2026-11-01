"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { preload } from "react-dom";
import { useSettings } from "@/components/SettingsProvider";
import { HOODIE_URL } from "@/lib/model";
import { normalizeName } from "@/lib/schemas";
import { prefersReducedMotion, webglAvailable } from "@/lib/webgl";
import type { HomePhoto } from "./Sections";
import { useHome } from "./store";

// three.js is fetched only here, only in the browser, and only when 3D is allowed.
const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false });

// The scene's first frame, rendered by scripts/capture-hero-poster.mjs. The 3D fades in over it, so nothing seems to swap.
const POSTER = `/products/hero-poster.webp?v=${process.env.NEXT_PUBLIC_STILLS_VERSION ?? "dev"}`;

type Mode = "deciding" | "3d" | "static";

// The home page's 3D hoodie: drag it, and scrolling turns it round to the back.
export function HeroStage({ hero }: { hero: HomePhoto }) {
  preload(HOODIE_URL, { as: "fetch", crossOrigin: "anonymous" }); // model download starts with the page, not after the JS
  const s = useSettings();
  const colorway = useHome((st) => st.colorway);
  const name = useHome((st) => st.name);
  const [mode, setMode] = useState<Mode>("deciding");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const decide = () => setMode(!prefersReducedMotion() && webglAvailable() ? "3d" : "static");
    decide();
    query.addEventListener("change", decide);
    return () => query.removeEventListener("change", decide);
  }, []);

  const href = hero ? `/shop/${hero.slug}` : colorway ? `/shop/${colorway.slug}` : "/shop";
  const live = mode === "3d" && ready;
  return (
    // No panel colour: the hoodie and its glow sit straight on the page with no box edge.
    <div className="relative aspect-[4/5] [container-type:inline-size] md:aspect-square">
      <div aria-hidden className="pointer-events-none absolute -inset-[10%] bg-[radial-gradient(closest-side,rgba(255,59,31,0.22),transparent)]" />

      <Image
        src={POSTER}
        alt="The IIT Bombay hoodie"
        fill
        priority
        sizes="(min-width: 768px) 45vw, 100vw"
        className={`object-cover transition-opacity duration-700 ${live ? "opacity-0" : "opacity-100"}`}
      />

      {mode === "3d" && colorway && (
        <div className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}>
          <HeroScene body={colorway.body} stitch={colorway.stitch} name={normalizeName(name, s)} onReady={() => setReady(true)} />
        </div>
      )}

      {mode !== "static" && (
        <p role="status" className="label pointer-events-none absolute bottom-3 left-3">
          {live ? (
            <>
              Drag to turn<span className="hidden sm:inline"> · scroll to see the back</span>
            </>
          ) : (
            <span className="animate-pulse">Loading 3D…</span>
          )}
        </p>
      )}
      <Link href={href} className="label absolute bottom-3 right-3 border border-line bg-bg/70 px-2.5 py-1.5 backdrop-blur-sm hover:text-fg">
        Shop it →
      </Link>
    </div>
  );
}

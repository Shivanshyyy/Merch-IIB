"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSettings } from "@/components/SettingsProvider";
import { ColorwayImage } from "@/components/shop/ColorwayImage";
import { normalizeName } from "@/lib/schemas";
import { prefersReducedMotion, webglAvailable } from "@/lib/webgl";
import type { HomePhoto } from "./Sections";
import { useHome } from "./store";

// three.js is fetched only here, only in the browser, and only when 3D is allowed.
const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false });

// The home page's 3D hoodie (drag it; scrolling turns it round to the back). The photo stays as the first paint and the fallback.
export function HeroStage({ hero }: { hero: HomePhoto }) {
  const s = useSettings();
  const colorway = useHome((st) => st.colorway);
  const name = useHome((st) => st.name);
  const [use3d, setUse3d] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const decide = () => setUse3d(!prefersReducedMotion() && webglAvailable());
    decide();
    query.addEventListener("change", decide);
    return () => query.removeEventListener("change", decide);
  }, []);

  const href = hero ? `/shop/${hero.slug}` : colorway ? `/shop/${colorway.slug}` : "/shop";
  return (
    <div className="relative aspect-[4/5] overflow-hidden bg-bg-2 [container-type:inline-size] md:aspect-square">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(55%_50%_at_50%_58%,rgba(255,59,31,0.28),transparent_72%)]" />
      <div className={`absolute inset-0 transition-opacity duration-700 ${use3d && ready ? "pointer-events-none opacity-0" : "opacity-100"}`}>
        {hero ? (
          <Image src={hero.src} alt={hero.alt} fill priority sizes="(min-width: 768px) 45vw, 100vw" className="object-cover" />
        ) : colorway ? (
          <ColorwayImage slug={colorway.slug} colorway={colorway.name} body={colorway.body} stitch={colorway.stitch} alt={`${colorway.name} hoodie`} priority sizes="(min-width: 768px) 45vw, 100vw" className="object-cover object-top" />
        ) : null}
      </div>
      {use3d && colorway && (
        <div className={`absolute inset-0 transition-opacity duration-1000 ${ready ? "opacity-100" : "opacity-0"}`}>
          <HeroScene body={colorway.body} stitch={colorway.stitch} name={normalizeName(name, s)} onReady={() => setReady(true)} />
        </div>
      )}
      {use3d && ready && <p className="label pointer-events-none absolute bottom-3 left-3">Drag to turn · scroll to see the back</p>}
      <Link href={href} className="label absolute bottom-3 right-3 border border-line bg-bg/70 px-2.5 py-1.5 backdrop-blur-sm hover:text-fg">
        Shop it →
      </Link>
    </div>
  );
}

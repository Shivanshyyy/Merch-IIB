"use client";

import { useEffect } from "react";
import { Sections, type HomeBatch, type HomePhoto } from "./Sections";
import type { PromoView } from "@/lib/promo";
import { useHome, type HomeColorway } from "./store";

export function HomeExperience({ colorways, batch, hero, promo }: { colorways: HomeColorway[]; batch: HomeBatch; hero: HomePhoto; promo: PromoView | null }) {
  useEffect(() => {
    const { colorway, setColorway } = useHome.getState();
    if (!colorway && colorways[0]) setColorway(colorways[0]);
  }, [colorways]);

  return <Sections colorways={colorways} batch={batch} hero={hero} promo={promo} />;
}

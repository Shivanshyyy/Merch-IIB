"use client";

import { useEffect } from "react";
import { Sections, type HomeBatch, type HomePhoto } from "./Sections";
import { useHome, type HomeColorway } from "./store";

export function HomeExperience({ colorways, batch, hero }: { colorways: HomeColorway[]; batch: HomeBatch; hero: HomePhoto }) {
  useEffect(() => {
    const { colorway, setColorway } = useHome.getState();
    if (!colorway && colorways[0]) setColorway(colorways[0]);
  }, [colorways]);

  return <Sections colorways={colorways} batch={batch} hero={hero} />;
}

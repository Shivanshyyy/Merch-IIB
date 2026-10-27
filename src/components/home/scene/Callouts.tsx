"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useSettings } from "@/components/SettingsProvider";
import type { HoodieAnchors } from "@/components/three/HoodieModel";
import { placeCallout } from "../callout-layout";
import { useHome } from "../store";

// A dot on the cloth, a hairline leader, and a mono label. Pinned to real points on the model, so they follow it.
function Callout({ at, side, shot, on, label }: { at: THREE.Vector3; side: "left" | "right"; shot: string; on: boolean; label: string }) {
  const group = useRef<THREE.Group>(null);
  const el = useRef<HTMLDivElement>(null);
  const point = useMemo(() => new THREE.Vector3(), []);
  const size = useThree((s) => s.size);
  const layout = useRef({ at: -1e9, copyTop: Infinity, headerBottom: 64, applied: "" });

  // On a wide screen the text column sits on one side, so open away from it (`side` says which way is free); on a phone
  // the text is below, so open toward the middle. Either way flip when the label would run off the screen (and wrap or
  // hide it when neither side has room), and on a phone hide a label whose dot lands on the text block.
  useEffect(() => {
    layout.current.at = -1e9; // measure straight away when a shot starts
  }, [on]);

  useFrame(({ camera }) => {
    if (!on || !group.current || !el.current) return;
    point.copy(at);
    group.current.localToWorld(point).project(camera);
    const portrait = size.width / size.height < 0.9;
    const sx = (point.x * 0.5 + 0.5) * size.width;
    const sy = (-point.y * 0.5 + 0.5) * size.height;

    const l = layout.current;
    const now = performance.now();
    if (now - l.at > 120) {
      // Layout reads, a few times a second is plenty.
      l.at = now;
      const copy = document.querySelector<HTMLElement>(`[data-shot="${shot}"] [data-copy]`);
      l.copyTop = copy ? copy.getBoundingClientRect().top : Infinity;
      l.headerBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? 64;
    }

    const place = placeCallout({ sx, sy, width: size.width, height: size.height, top: l.headerBottom, chars: label.length, prefer: portrait ? (point.x < 0 ? "right" : "left") : side, portrait });
    const hidden = !place.fits || (portrait && sy > l.copyTop - 16);
    const applied = `${place.side}|${place.leader}|${Math.floor(place.max)}|${hidden}`;
    if (applied !== l.applied) {
      l.applied = applied;
      el.current.dataset.side = place.side;
      el.current.dataset.hidden = String(hidden);
      el.current.style.setProperty("--leader", `${place.leader}px`);
      el.current.style.setProperty("--max", `${Math.floor(place.max)}px`);
    }
  });

  return (
    <group ref={group}>
      <Html position={at} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div ref={el} className={`callout ${on ? "callout-on" : ""}`} data-side={side} aria-hidden>
          <span className="callout-dot" />
          <span className="callout-line" />
          <span className="callout-text">{label}</span>
        </div>
      </Html>
    </group>
  );
}

export function Callouts({ anchors }: { anchors: HoodieAnchors | null }) {
  const shot = useHome((s) => s.shot);
  const specs = useSettings().fabricSpecs;
  if (!anchors) return null;

  // Spec values of "—" are placeholders until the vendor confirms them: show the label only.
  const text = (i: number) => {
    const f = specs[i];
    return f ? (f.value && f.value !== "—" ? `${f.label}: ${f.value}` : f.label) : null;
  };
  // Text is on the left for the fabric/hood/back shots (labels open right) and on the right for the cuff shot (labels open left).
  const places = [
    { at: anchors.chest, side: "right" as const },
    { at: anchors.hem, side: "right" as const },
    { at: anchors.cuff, side: "right" as const },
  ];

  return (
    <>
      {places.map((p, i) => {
        const label = text(i);
        return label && <Callout key={i} at={p.at} side={p.side} shot="fabric" on={shot === "fabric"} label={label} />;
      })}
      <Callout at={anchors.cuff} side="left" shot="cuff" on={shot === "cuff"} label="Rib cuffs" />
      <Callout at={anchors.stitch} side="left" shot="cuff" on={shot === "cuff"} label="Double stitching" />
      <Callout at={anchors.hood} side="right" shot="hood" on={shot === "hood"} label="The hood" />
    </>
  );
}

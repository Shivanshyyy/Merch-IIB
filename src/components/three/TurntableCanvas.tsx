"use client";

import { Center } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useRef } from "react";
import type * as THREE from "three";
import type { Stage } from "@/components/home/scene/CameraRig";
import { Lights } from "@/components/home/scene/Environment";
import { Hoodie } from "@/components/three/HoodieModel";
import { ReadyAfterCompile } from "./ReadyAfterCompile";

const TURN_SECONDS = 14; // one slow full turn

function Turn({ children }: { children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += (Math.PI * 2 * Math.min(dt, 0.1)) / TURN_SECONDS;
  });
  return <group ref={g}>{children}</group>;
}

// The one 3D view the shop shares between its cards: it is moved onto whichever card is hovered and takes that card's colours.
export default function TurntableCanvas({ body, stitch, active, onReady }: { body: string; stitch: string; active: boolean; onReady: () => void }) {
  const stage = useRef<Stage>({ az: 0, rot: 0, t: 0, mode: "script" });
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ fov: 28, near: 0.05, far: 50, position: [0, 0.22, 2.3] }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      frameloop={active ? "always" : "demand"}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.25;
      }}
    >
      <Suspense fallback={null}>
        <Lights stage={stage} body={body} stitch={stitch} />
        <Turn>
          <Center>
            <Hoodie body={body} stitch={stitch} glow={0.45} />
          </Center>
        </Turn>
        <ReadyAfterCompile onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}

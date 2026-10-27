"use client";

import { Center, Float, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Lights, Shadows } from "@/components/home/scene/Environment";
import type { Stage } from "@/components/home/scene/CameraRig";
import { wrapPi } from "@/components/home/shots";
import { Hoodie } from "@/components/three/HoodieModel";
import { ReadyAfterCompile } from "./ReadyAfterCompile";
import { useActive } from "@/components/three/useActive";

const FRONT = 0.5; // the three-quarter view the still uses
const BACK = Math.PI; // square-on, where the name goes

type Props = { body: string; stitch: string; name: string; view: "front" | "back"; reducedMotion: boolean; onReady: () => void };

// Keeps the key/rim lights in the same place relative to the camera, and swings round when the Front/Back toggle is used.
function Rig({ view, stage, touched }: { view: "front" | "back"; stage: React.MutableRefObject<Stage>; touched: React.MutableRefObject<boolean> }) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const goal = view === "back" ? BACK : FRONT;
  useFrame((_, dt) => {
    if (!controls) return;
    const cur = controls.getAzimuthalAngle();
    stage.current.az = cur;
    if (touched.current) return;
    const d = wrapPi(goal - cur);
    if (Math.abs(d) > 0.003) {
      controls.setAzimuthalAngle(cur + d * (1 - Math.exp(-Math.min(dt, 0.1) * 5)));
      controls.update();
    }
  });
  return null;
}

export default function ProductViewer({ body, stitch, name, view, reducedMotion, onReady }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const active = useActive(box);
  const stage = useRef<Stage>({ az: FRONT, rot: 0, t: 0, mode: "script" });
  const touched = useRef(false);
  const [spinning, setSpinning] = useState(!reducedMotion);
  const [weak] = useState(() => matchMedia("(pointer: coarse)").matches || innerWidth < 768);

  // The toggle hands control back to the tween and stops the idle spin.
  useEffect(() => {
    touched.current = false;
    const id = requestAnimationFrame(() => setSpinning(false));
    return () => cancelAnimationFrame(id);
  }, [view]);

  const r = 2.05;
  return (
    <div ref={box} className="absolute inset-0" style={{ touchAction: "pan-y" }}>
      <Canvas
        dpr={[1, weak ? 1.25 : 1.6]}
        camera={{ fov: 28, near: 0.05, far: 50, position: [r * Math.sin(FRONT) * Math.cos(0.12), r * Math.sin(0.12), r * Math.cos(FRONT) * Math.cos(0.12)] }}
        gl={{ alpha: true, antialias: !weak, powerPreference: "high-performance" }}
        frameloop={active ? "always" : "demand"}
        onCreated={({ gl, camera, scene }) => {
          gl.domElement.style.touchAction = "pan-y"; // vertical swipes scroll the page, horizontal drags turn the hoodie
          gl.toneMappingExposure = 1.25;
          // Test handle, only with ?debug in the URL.
          if (location.search.includes("debug")) (window as unknown as { __productScene?: unknown }).__productScene = { camera, scene, gl };
        }}
      >
        <Suspense fallback={null}>
          <Lights stage={stage} body={body} stitch={stitch} />
          <Center>
            <Float speed={1} rotationIntensity={0.05} floatIntensity={0.15} floatingRange={[-0.006, 0.006]}>
              <Hoodie body={body} stitch={stitch} name={name} />
            </Float>
          </Center>
          <Shadows />
          <Rig view={view} stage={stage} touched={touched} />
          <ReadyAfterCompile onReady={onReady} />
        </Suspense>
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.7}
          minPolarAngle={0.85}
          maxPolarAngle={Math.PI / 2 + 0.05}
          autoRotate={spinning}
          autoRotateSpeed={1.1}
          onStart={() => {
            touched.current = true;
            setSpinning(false);
          }}
        />
      </Canvas>
    </div>
  );
}

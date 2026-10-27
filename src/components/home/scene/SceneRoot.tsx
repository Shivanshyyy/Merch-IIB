"use client";

import { Center, Float, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useCallback, useRef, useState } from "react";
import * as THREE from "three";
import { Hoodie, type HoodieAnchors } from "@/components/three/HoodieModel";
import { ReadyAfterCompile } from "@/components/three/ReadyAfterCompile";
import { useActive } from "@/components/three/useActive";
import { useSettings } from "@/components/SettingsProvider";
import { normalizeName } from "@/lib/schemas";
import { shotsFor, type Pose } from "../shots";
import { useHome } from "../store";
import { Callouts } from "./Callouts";
import { CameraRig, type Stage } from "./CameraRig";
import { Effects } from "./Effects";
import { Backdrop, Embers, Floor, Lights, Shadows } from "./Environment";
import { ScrollDirector } from "./ScrollDirector";

// A phone, a coarse pointer, a small screen or few cores: start on the cheap settings.
const weakDevice = () => matchMedia("(pointer: coarse)").matches || innerWidth < 768 || (navigator.hardwareConcurrency ?? 8) <= 4;

// The hoodie, turning slowly against the camera's orbit while idle.
function Stage({ stage, children }: { stage: React.MutableRefObject<Stage>; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    if (g.current) g.current.rotation.y = stage.current.rot;
  });
  return <group ref={g}>{children}</group>;
}

export default function SceneRoot() {
  const measuredQuality = useHome((s) => s.quality);
  const setQuality = useHome((s) => s.setQuality);
  const ready = useHome((s) => s.sceneReady);
  const setSceneReady = useHome((s) => s.setSceneReady);
  const colorway = useHome((s) => s.colorway);
  const name = useHome((s) => s.name);
  const settings = useSettings();
  const active = useActive();

  const pose = useRef<Pose>({ ...shotsFor(innerWidth / innerHeight < 0.9).hero });
  const stage = useRef<Stage>({ az: 0, rot: 0, t: 0, mode: "script" });
  const scrolled = useRef(0);
  const [anchors, setAnchors] = useState<HoodieAnchors | null>(null);
  const [mobile] = useState(() => weakDevice());
  const quality = mobile ? "low" : measuredQuality; // weak devices start cheap; PerformanceMonitor can also demote the rest

  const body = colorway?.body ?? "#0e0e10";
  const stitch = colorway?.stitch ?? "#e01e0a";
  const onScroll = useCallback(() => {
    scrolled.current++;
  }, []);

  return (
    <div aria-hidden data-cursor="drag" data-scene-ready={ready} className={`fixed inset-0 z-0 transition-opacity duration-1000 ${ready ? "opacity-100" : "opacity-0"}`} style={{ touchAction: "pan-y" }}>
      <Canvas
        dpr={[1, quality === "high" ? 1.75 : 1.25]}
        camera={{ fov: 28, near: 0.05, far: 120, position: [0, 0.3, 2.4] }}
        gl={{ antialias: quality === "high", powerPreference: "high-performance", alpha: false }}
        frameloop={active ? "always" : "demand"}
        onCreated={({ gl, camera, scene }) => {
          gl.domElement.style.touchAction = "pan-y"; // vertical swipes scroll the page, horizontal drags orbit
          gl.toneMappingExposure = 1.25;
          // Test handle: lets the browser tests read the real camera and rig state. Only with ?debug in the URL.
          if (location.search.includes("debug")) (window as unknown as { __homeScene?: unknown }).__homeScene = { camera, scene, gl, pose: pose.current, stage: stage.current, store: useHome };
        }}
      >
        <color attach="background" args={["#0a0a0b"]} />
        <fog attach="fog" args={["#0a0a0b", 5, 14]} />
        <PerformanceMonitor onDecline={() => setQuality("low")} />
        <Suspense fallback={null}>
          <Backdrop stage={stage} />
          <Lights stage={stage} body={body} stitch={stitch} />
          <Stage stage={stage}>
            <Center>
              <Float speed={1} rotationIntensity={0.12} floatIntensity={0.25} floatingRange={[-0.01, 0.01]}>
                <Hoodie body={body} stitch={stitch} name={normalizeName(name, settings)} onReady={setAnchors} />
                <Callouts anchors={anchors} />
              </Float>
            </Center>
          </Stage>
          <Floor quality={quality} />
          <Shadows />
          <Embers quality={quality} />
          <CameraRig pose={pose} stage={stage} scrolled={scrolled} />
          {quality === "high" && !mobile && <Effects />}
          <ReadyAfterCompile onReady={setSceneReady} />
        </Suspense>
      </Canvas>
      <ScrollDirector pose={pose} onScroll={onScroll} />
    </div>
  );
}

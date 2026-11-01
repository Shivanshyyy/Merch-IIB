"use client";

import { Center, ContactShadows, Environment, Float, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Hoodie } from "@/components/three/HoodieModel";
import { ReadyAfterCompile } from "@/components/three/ReadyAfterCompile";
import { useActive } from "@/components/three/useActive";

type Props = { body: string; stitch: string; name: string; onReady: () => void };

// Page scroll turns the hoodie from the front to the back (where the name goes) as the hero leaves the screen.
function ScrollTurn({ box, children }: { box: React.RefObject<HTMLDivElement | null>; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  const turn = useRef(0);
  useFrame((_, dt) => {
    const el = box.current;
    if (!g.current || !el) return;
    const r = el.getBoundingClientRect();
    // 0 at the top of the page, 1 once half the hero has scrolled away.
    const progress = THREE.MathUtils.clamp(scrollY / Math.max(1, r.top + scrollY + r.height * 0.5), 0, 1);
    turn.current = THREE.MathUtils.damp(turn.current, progress * Math.PI, 6, Math.min(dt, 0.1));
    g.current.rotation.y = turn.current;
  });
  return <group ref={g}>{children}</group>;
}

export default function HeroScene({ body, stitch, name, onReady }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const active = useActive(box);
  const [weak] = useState(() => matchMedia("(pointer: coarse)").matches || innerWidth < 768);
  const [spin, setSpin] = useState(true);

  // Idle spin resumes a few seconds after a drag.
  const idle = useRef<number>(0);
  useEffect(() => () => clearTimeout(idle.current), []);

  return (
    <div ref={box} data-cursor="drag" className="absolute inset-0" style={{ touchAction: "pan-y" }}>
      <Canvas
        dpr={[1, weak ? 1.25 : 1.6]}
        camera={{ fov: 26, near: 0.05, far: 40, position: [0, 0.18, 2.5] }}
        gl={{ alpha: true, antialias: !weak, powerPreference: "high-performance" }}
        frameloop={active ? "always" : "demand"}
        onCreated={({ gl }) => {
          gl.domElement.style.touchAction = "pan-y"; // vertical swipes scroll the page, horizontal drags turn the hoodie
          gl.toneMappingExposure = 1.2;
        }}
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[2.5, 3, 3]} intensity={2.2} color="#fff1e0" />
        <directionalLight position={[-3, 1.5, -2.5]} intensity={2.4} color="#ff3b1f" />
        <Suspense fallback={null}>
          <Environment resolution={64}>
            <Lightformer intensity={1.2} position={[0, 2, 3]} scale={[4, 2, 1]} />
            <Lightformer intensity={0.6} color="#ffb547" position={[-3, 0, -2]} scale={[2, 3, 1]} />
          </Environment>
          <ScrollTurn box={box}>
            <Center>
              <Float speed={1} rotationIntensity={0.08} floatIntensity={0.2} floatingRange={[-0.01, 0.01]}>
                <Hoodie body={body} stitch={stitch} name={name} />
              </Float>
            </Center>
          </ScrollTurn>
          <ContactShadows position={[0, -0.42, 0]} opacity={0.55} scale={2.2} blur={2.6} far={1} />
          <ReadyAfterCompile onReady={onReady} />
        </Suspense>
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.7}
          minPolarAngle={1.2}
          maxPolarAngle={Math.PI / 2 + 0.05}
          autoRotate={spin}
          autoRotateSpeed={0.9}
          onStart={() => {
            clearTimeout(idle.current);
            setSpin(false);
          }}
          onEnd={() => {
            idle.current = window.setTimeout(() => setSpin(true), 3000);
          }}
        />
      </Canvas>
    </div>
  );
}

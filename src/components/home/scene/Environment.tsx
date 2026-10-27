"use client";

import { Environment, Lightformer, MeshReflectorMaterial, Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { rimFor } from "../colors";
import type { Stage } from "./CameraRig";

export const FLOOR_Y = -0.38; // just under the hem, so the reflection reads as a stage

// A big inverted sphere with a faint ember glow BEHIND the hoodie. It turns with the camera, so the glow is always there.
export function Backdrop({ stage }: { stage: MutableRefObject<Stage> }) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { uBase: { value: new THREE.Color("#0a0a0b") }, uGlow: { value: new THREE.Color("#ff3b1f") } },
        vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `
          varying vec3 vDir; uniform vec3 uBase; uniform vec3 uGlow;
          void main(){
            vec3 d = normalize(vDir);
            // A soft halo behind the hoodie, sitting just above the horizon and fading out into the floor's fog.
            float behind = max(dot(d, normalize(vec3(0.0, 0.16, -1.0))), 0.0);
            float glow = pow(behind, 9.0) * 0.5 * smoothstep(0.0, 0.2, d.y);
            vec3 col = mix(uBase, uGlow * 0.42, clamp(glow, 0.0, 1.0));
            col *= mix(1.0, 0.5, smoothstep(0.1, 0.95, d.y)); // darker overhead
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    [],
  );
  useFrame(() => {
    if (mesh.current) mesh.current.rotation.y = stage.current.az; // local -z (the glow) ends up opposite the camera
  });
  return (
    <mesh ref={mesh} renderOrder={-10} material={material}>
      <sphereGeometry args={[40, 32, 16]} />
    </mesh>
  );
}

// A glossy floor catches the key and rim lights, and the studio environment, as broad bright bands at grazing angles
// (a pink stripe, then a grey haze). The floor should show only its mirrored reflection, so both specular terms are
// cut from its shader. (material.envMapIntensity doesn't scale the scene environment in this three.js.)
function tameSpecular(material: THREE.Material | null) {
  if (!material || material.userData.tamed) return;
  material.userData.tamed = true;
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n reflectedLight.directSpecular *= 0.04; reflectedLight.indirectSpecular *= 0.03;");
  };
  material.customProgramCacheKey = () => "floor-mirror-only";
  material.needsUpdate = true;
}

// Dark floor with a soft blurred reflection; plain dark on weak devices.
export function Floor({ quality }: { quality: "high" | "low" }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={FLOOR_Y}>
      <planeGeometry args={[60, 60]} />
      {quality === "high" ? (
        <MeshReflectorMaterial ref={tameSpecular} color="#1c1c22" envMapIntensity={0} blur={[340, 100]} resolution={512} mixBlur={1} mixStrength={10} mirror={0.45} roughness={1} metalness={0.15} depthScale={0.5} minDepthThreshold={0.4} maxDepthThreshold={1.4} />
      ) : (
        <meshStandardMaterial ref={tameSpecular} color="#040405" roughness={0.9} metalness={0.1} envMapIntensity={0} />
      )}
    </mesh>
  );
}

// A soft contact shadow under the hoodie: one baked radial gradient, so it costs nothing per frame. (drei's ContactShadows
// re-renders the whole scene every frame, and on a reflective floor it draws a visible hard-edged slab.)
export function Shadows() {
  const map = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, "rgba(0,0,0,0.95)");
    grad.addColorStop(0.4, "rgba(0,0,0,0.6)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }, []);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, FLOOR_Y + 0.003, 0]} renderOrder={1}>
      <planeGeometry args={[1.5, 1.0]} />
      <meshBasicMaterial map={map} transparent depthWrite={false} opacity={0.85} />
    </mesh>
  );
}

export const Embers = ({ quality }: { quality: "high" | "low" }) => (
  <>
    {/* Kept small enough that the camera orbits outside the cloud: a particle near the lens becomes a huge disc. */}
    <Sparkles count={quality === "high" ? 60 : 20} scale={[1.7, 1.2, 1.7]} size={quality === "high" ? 1.8 : 2.4} speed={0.25} opacity={0.85} color="#ff8a4a" />
    <Sparkles count={quality === "high" ? 22 : 8} scale={[2.0, 1.4, 2.0]} size={quality === "high" ? 2.4 : 3} speed={0.18} opacity={0.7} color="#ff3b1f" />
  </>
);

export function Lights({ stage, body, stitch }: { stage: MutableRefObject<Stage>; body: string; stitch: string }) {
  const rig = useRef<THREE.Group>(null);
  const rim = useRef<THREE.DirectionalLight>(null);
  const target = useRef(new THREE.Color(rimFor(body, stitch)));
  useEffect(() => {
    target.current.set(rimFor(body, stitch));
  }, [body, stitch]);

  useFrame((_, dt) => {
    // The key and rim stay in the same place relative to the camera, so every shot is lit like a product launch.
    if (rig.current) rig.current.rotation.y = stage.current.az * 0.85;
    if (rim.current) rim.current.color.lerp(target.current, 1 - Math.exp(-dt * 5)); // ~600 ms
  });

  return (
    <>
      {/* Studio reflections from a few soft panels: no HDR download, nothing to wait for on a slow connection. */}
      <Environment resolution={256} frames={1} environmentIntensity={1.0}>
        <Lightformer form="rect" intensity={1.6} position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
        <Lightformer form="rect" color="#ffd6a8" intensity={3} position={[-4, 1, 2]} rotation-y={Math.PI / 2.4} scale={[3, 5, 1]} />
        <Lightformer form="rect" color="#cfd8ff" intensity={1.6} position={[4, 1, 1]} rotation-y={-Math.PI / 2.4} scale={[3, 5, 1]} />
        <Lightformer form="rect" color="#ff3b1f" intensity={1.8} position={[0, 1, -4]} scale={[8, 1.2, 1]} />
        <Lightformer form="rect" color="#ffffff" intensity={1.2} position={[0, 0.5, 4]} scale={[6, 3, 1]} />
      </Environment>
      <group ref={rig}>
        <directionalLight color="#ffd9b0" intensity={3.6} position={[2.5, 3, 4]} />
        <directionalLight ref={rim} color={rimFor(body, stitch)} intensity={4.5} position={[-3, 1.5, -3.5]} />
        <directionalLight color="#cfd8ff" intensity={1} position={[-3, 0.5, 3]} />
      </group>
    </>
  );
}

"use client";

// Typed after public/models/hoodie.glb (one mesh, one material), extended with:
//  - colourways that cross-fade in ~600 ms: the cloth takes the body colour, the emblem the stitch colour (see lib/hoodie-tint.js)
//  - a name decal projected onto the back, rendered from a CanvasTexture
//  - anchor points on the surface, found by ray casting, for callouts and camera shots
// The model's credit, if it needs one, lives in site.modelCredit.
import { useFrame, type ThreeElements } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import type { GLTF } from "three-stdlib";

import { tintHoodie } from "@/lib/hoodie-tint";
import { HOODIE_URL } from "@/lib/model";

type GLTFResult = GLTF & {
  nodes: { hoodie: THREE.Mesh };
  materials: { fabric: THREE.MeshStandardMaterial };
};

// Points on the garment in the hoodie group's own coordinates.
export type HoodieAnchors = { chest: THREE.Vector3; hem: THREE.Vector3; cuff: THREE.Vector3; stitch: THREE.Vector3; hood: THREE.Vector3; backName: THREE.Vector3 };

type Props = {
  body: string;
  stitch: string;
  name?: string;
  /** Emissive strength of the emblem (Bloom picks this up). */
  glow?: number;
  onReady?: (anchors: HoodieAnchors) => void;
} & Omit<ThreeElements["group"], "ref">;

const FADE_SECONDS = 0.6;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// Draws the name in white on a transparent canvas; the decal material tints it with the stitch colour.
function drawName(canvas: HTMLCanvasElement, text: string, family: string) {
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!text) return;
  const letters = [...text];
  const spacing = 0.12; // in em
  let size = canvas.height * 0.78;
  const measure = () => {
    ctx.font = `800 ${size}px ${family}`;
    return letters.reduce((w, c) => w + ctx.measureText(c).width + size * spacing, -size * spacing);
  };
  let width = measure();
  const max = canvas.width * 0.8; // leaves a margin so oblique views never slice the end letters
  if (width > max) {
    size *= max / width;
    width = measure();
  }
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  let x = (canvas.width - width) / 2;
  for (const c of letters) {
    ctx.fillText(c, x, canvas.height / 2 + size * 0.04);
    x += ctx.measureText(c).width + size * spacing;
  }
}

const ray = new THREE.Raycaster();

export function Hoodie({ body, stitch, name = "", glow = 0.55, onReady, ...group }: Props) {
  const { nodes, materials } = useGLTF(HOODIE_URL) as unknown as GLTFResult;
  const root = useRef<THREE.Group>(null);
  const garment = useRef<THREE.Mesh>(null);
  const [decalGeometry, setDecalGeometry] = useState<THREE.BufferGeometry | null>(null);

  // ---- colourway cross-fade
  // Own copy of the material: the GLTF cache is shared, and every canvas needs its own colour uniforms.
  const fabric = useMemo(() => materials.fabric.clone(), [materials]);
  const tint = useMemo(() => tintHoodie(fabric), [fabric]);
  useEffect(() => () => fabric.dispose(), [fabric]);
  const fade = useRef({ from: { body: new THREE.Color(body), stitch: new THREE.Color(stitch) }, to: { body: new THREE.Color(body), stitch: new THREE.Color(stitch) }, now: { body: new THREE.Color(body), stitch: new THREE.Color(stitch) }, t: 1 });

  // ---- name decal
  const family = useMemo(() => (typeof document === "undefined" ? "sans-serif" : getComputedStyle(document.body).getPropertyValue("--font-unbounded").trim() || "sans-serif"), []);
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 2048;
    c.height = 512;
    return c;
  }, []);
  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [canvas]);
  const decalMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, roughness: 0.85, metalness: 0, emissiveIntensity: 0 }),
    [texture],
  );

  const apply = () => {
    const f = fade.current;
    tint.uBody.value.copy(f.now.body);
    tint.uEmblem.value.copy(f.now.stitch);
    tint.uGlow.value = glow;
    decalMaterial.color.copy(f.now.stitch);
  };

  useLayoutEffect(() => {
    const f = fade.current;
    f.now.body.set(body);
    f.now.stitch.set(stitch);
    apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first colours are applied once; later changes fade
  }, []);

  useEffect(() => {
    const f = fade.current;
    f.from.body.copy(f.now.body);
    f.from.stitch.copy(f.now.stitch);
    f.to.body.set(body);
    f.to.stitch.set(stitch);
    f.t = 0;
  }, [body, stitch]);


  useEffect(() => {
    let live = true;
    const paint = () => {
      if (!live) return;
      drawName(canvas, name, family);
      texture.needsUpdate = true;
    };
    // The brand font may still be loading; paint now and again once it is ready.
    paint();
    void document.fonts?.load(`800 100px ${family}`).then(paint);
    return () => {
      live = false;
    };
  }, [name, family, canvas, texture]);

  // ---- surface anchors + the decal geometry, once the meshes are in the scene
  useLayoutEffect(() => {
    const r = root.current;
    const b = garment.current;
    if (!r || !b) return;
    r.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(r.matrixWorld).invert();

    // Shoot a ray at a mesh from `from` (hoodie coordinates) along `dir`; returns the hit point and normal in hoodie coordinates.
    const hit = (mesh: THREE.Mesh, from: THREE.Vector3, dir: THREE.Vector3) => {
      const o = from.clone().applyMatrix4(r.matrixWorld);
      const d = dir.clone().transformDirection(r.matrixWorld).normalize();
      ray.set(o, d);
      const h = ray.intersectObject(mesh, false)[0];
      if (!h?.face) return null;
      const n = h.face.normal.clone().transformDirection(mesh.matrixWorld).transformDirection(inv).normalize();
      return { point: h.point.clone().applyMatrix4(inv), normal: n };
    };
    // The optimiser centres the geometry on the origin and `Center` only moves the container, so this is ~0; anchors below
    // are written relative to the garment's own centre and shifted by whatever it measures.
    const centre = new THREE.Box3().setFromObject(r).applyMatrix4(inv).getCenter(new THREE.Vector3());
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).add(centre);
    const dirV = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const at = (mesh: THREE.Mesh, from: THREE.Vector3, dir: THREE.Vector3, fallback: THREE.Vector3) => hit(mesh, from, dir)?.point ?? fallback;

    const anchors: HoodieAnchors = {
      chest: at(b, v(-0.11, 0.07, 1), dirV(0, 0, -1), v(-0.11, 0.07, 0.17)),
      hem: at(b, v(0.14, -0.2, 1), dirV(0, 0, -1), v(0.14, -0.2, 0.17)),
      cuff: at(b, v(-1, -0.25, 0.05), dirV(1, 0, 0), v(-0.27, -0.25, 0.05)),
      stitch: at(b, v(-0.12, -0.265, 1), dirV(0, 0, -1), v(-0.12, -0.265, 0.17)),
      hood: at(b, v(0, 1, -0.05), dirV(0, -1, 0), v(0, 0.3, -0.05)),
      backName: v(0, 0.06, -0.16),
    };

    // Project a name-sized rectangle onto the back so it follows the cloth's curve. Kept narrower than the back panel:
    // past the side seams the sleeve shells sit in front and would slice the letters.
    const back = hit(b, v(0, 0.06, -1), dirV(0, 0, 1));
    if (back) {
      anchors.backName.copy(back.point);
      const world = back.point.clone().applyMatrix4(r.matrixWorld);
      const nWorld = back.normal.clone().transformDirection(r.matrixWorld);
      const look = new THREE.Matrix4().lookAt(world.clone().add(nWorld), world, new THREE.Vector3(0, 1, 0));
      const orientation = new THREE.Euler().setFromRotationMatrix(look);
      b.updateMatrixWorld(true);
      const geo = new DecalGeometry(b, world, orientation, new THREE.Vector3(0.24, 0.06, 0.12));
      geo.applyMatrix4(inv);
      setDecalGeometry(geo);
    }
    onReady?.(anchors);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- measured once, after the first layout
  }, [nodes]);

  useFrame((_, dt) => {
    const f = fade.current;
    if (f.t >= 1) return;
    f.t = Math.min(1, f.t + dt / FADE_SECONDS);
    const e = ease(f.t);
    f.now.body.copy(f.from.body).lerp(f.to.body, e);
    f.now.stitch.copy(f.from.stitch).lerp(f.to.stitch, e);
    apply();
  });

  return (
    <group ref={root} {...group} dispose={null}>
      {/* The node's own transform undoes the geometry quantisation. */}
      <mesh ref={garment} name="hoodie" geometry={nodes.hoodie.geometry} material={fabric} position={nodes.hoodie.position} scale={nodes.hoodie.scale} />
      {decalGeometry && <mesh geometry={decalGeometry} material={decalMaterial} visible={name.length > 0} renderOrder={2} />}
    </group>
  );
}

useGLTF.preload(HOODIE_URL);

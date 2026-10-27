"use client";

import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { aspectBoost, wrapPi, type Pose } from "../shots";

// Values other parts of the scene follow (backdrop glow, light rig, the hoodie's counter-rotation).
export type Stage = { az: number; rot: number; t: number; mode: "script" | "user" | "blend" };

const ORBIT_SECONDS = 40; // one full circle while idle in the hero
const BOB = 0.15;
const RESUME_AFTER = 3; // seconds without touching it
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

type Mode = "script" | "user" | "blend";

// Drives the camera: the scripted pose (scroll shots + idle orbit) unless the visitor takes over by dragging.
// After 3 s of stillness, or as soon as they scroll, it blends back to the script without a jump.
export function CameraRig({ pose, stage, scrolled }: { pose: MutableRefObject<Pose>; stage: MutableRefObject<Stage>; scrolled: MutableRefObject<number> }) {
  const { camera, gl, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const s = useRef({ mode: "script" as Mode, idle: 0, rot: 0, spin: 0, last: 0, blend: 1, dur: 1.4, fromPos: new THREE.Vector3(), fromTarget: new THREE.Vector3(), seenScroll: 0 });
  const tmp = useRef({ pos: new THREE.Vector3(), target: new THREE.Vector3() });

  const startBlend = (seconds: number) => {
    const c = controls.current;
    if (!c) return;
    s.current.fromPos.copy(camera.position);
    s.current.fromTarget.copy(c.target);
    s.current.blend = 0;
    s.current.dur = seconds;
    s.current.mode = "blend";
  };

  // Double click (mouse) or double tap (touch) puts the view back, eased.
  useEffect(() => {
    const el = gl.domElement;
    const tap = { at: 0, x: 0, y: 0 };
    const onDouble = () => startBlend(0.8);
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return; // mouse uses dblclick
      const now = performance.now();
      if (now - tap.at < 320 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 30) onDouble();
      tap.at = now;
      tap.x = e.clientX;
      tap.y = e.clientY;
    };
    el.addEventListener("dblclick", onDouble);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("dblclick", onDouble);
      el.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers only touch refs
  }, [gl]);

  useFrame((_state, rawDt) => {
    const c = controls.current;
    if (!c) return;
    const m = s.current;
    const p = pose.current;
    const dt = Math.min(rawDt, 0.1); // a stalled tab must not fling the camera
    stage.current.t += dt;
    const orbit = p.orbit;

    // Idle angles only advance while their weight is exactly 1 (in the hero / colourways). Any other time they are
    // parked, so changing shots can never make the camera jump, and wrapping them is invisible.
    if (orbit >= 0.9999) {
      m.idle = wrapPi(m.idle + (Math.PI * 2 * dt) / ORBIT_SECONDS);
      m.rot = wrapPi(m.rot - 0.08 * dt); // the hoodie turns the other way, slowly
    }
    if (p.spin >= 0.9999) m.spin = wrapPi(m.spin + 0.18 * dt);

    // Scrolling hands control straight back to the script.
    if (scrolled.current !== m.seenScroll) {
      m.seenScroll = scrolled.current;
      if (m.mode === "user") startBlend(0.9);
    }
    if (m.mode === "user" && performance.now() / 1000 - m.last > RESUME_AFTER) startBlend(1.4);

    // The scripted pose for this frame.
    const aspect = size.width / size.height;
    const az = p.az + m.idle * orbit + m.spin * p.spin;
    const r = p.r * aspectBoost(aspect);
    const bob = Math.sin(stage.current.t * 0.55) * BOB * orbit;
    tmp.current.target.set(p.tx, p.ty, p.tz);
    tmp.current.pos.set(p.tx + r * Math.sin(az) * Math.cos(p.el), p.ty + r * Math.sin(p.el) + bob, p.tz + r * Math.cos(az) * Math.cos(p.el));
    stage.current.az = az;
    stage.current.rot = m.rot * orbit;
    stage.current.mode = m.mode;

    if (m.mode === "script") {
      camera.position.copy(tmp.current.pos);
      c.target.copy(tmp.current.target);
      c.update();
    } else if (m.mode === "blend") {
      m.blend = Math.min(1, m.blend + dt / m.dur);
      const e = ease(m.blend);
      camera.position.lerpVectors(m.fromPos, tmp.current.pos, e);
      c.target.lerpVectors(m.fromTarget, tmp.current.target, e);
      c.update();
      if (m.blend >= 1) m.mode = "script";
    }

    // Slide the whole picture sideways/up so the hoodie can sit beside the text.
    const persp = camera as THREE.PerspectiveCamera;
    if (persp.fov !== p.fov) {
      persp.fov = p.fov;
      persp.updateProjectionMatrix();
    }
    persp.setViewOffset(size.width, size.height, -p.ox * size.width, p.oy * size.height, size.width, size.height);
  }, -1);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableZoom={false} // the wheel scrolls the page; pinch is left to the browser
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.6}
      minPolarAngle={0.25}
      maxPolarAngle={Math.PI / 2 - 0.03} // never under the floor
      onStart={() => {
        s.current.mode = "user";
        s.current.last = Infinity; // while dragging, never resume
      }}
      onEnd={() => {
        s.current.last = performance.now() / 1000;
      }}
    />
  );
}

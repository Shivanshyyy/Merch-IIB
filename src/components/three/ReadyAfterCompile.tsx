"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

// Calls `onReady` once every shader is compiled, so the scene appears smoothly instead of freezing the page while the
// first frame builds them. Gives up waiting after a few seconds so a slow device never holds the page back.
export function ReadyAfterCompile({ onReady }: { onReady: () => void }) {
  const { gl, scene, camera } = useThree();
  const latest = useRef(onReady);
  useEffect(() => {
    latest.current = onReady;
  });

  useEffect(() => {
    let live = true;
    const finish = () => {
      if (!live) return;
      live = false;
      latest.current();
    };
    const timer = setTimeout(finish, 6000);
    gl.compileAsync(scene, camera).then(finish, finish);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [gl, scene, camera]);

  return null;
}

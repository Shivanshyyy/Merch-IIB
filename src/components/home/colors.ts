import * as THREE from "three";

// The rim light complements each colourway: the opposite hue on a coloured body, the thread colour on a neutral one.
export function rimFor(body: string, stitch: string): string {
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(body).getHSL(hsl);
  if (hsl.s >= 0.25) return `#${new THREE.Color().setHSL((hsl.h + 0.5) % 1, 0.85, 0.55).getHexString()}`;
  const th = { h: 0, s: 0, l: 0 };
  new THREE.Color(stitch).getHSL(th);
  return th.l > 0.25 ? stitch : "#ff3b1f";
}

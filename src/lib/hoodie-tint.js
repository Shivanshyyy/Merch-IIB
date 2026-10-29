// Plain JS so scripts/render-model.html (the product-still renderer) can import the very same tint as HoodieModel.tsx.
// The hoodie is one material: a near-black base map carrying a white emblem and silver metal, which would stay black under
// any colour multiply. So the cloth takes the body colour, the emblem takes the stitch colour, and metal keeps its own.
import { Color } from "three";

const TINT = /* glsl */ `
  vec3 mapRgb = diffuseColor.rgb;
  float emblem = smoothstep(0.05, 0.6, dot(mapRgb, vec3(0.2126, 0.7152, 0.0722)));
  float metal = texture2D(metalnessMap, vMetalnessMapUv).b; // aglets and eyelets
  emblem *= 1.0 - metal;
  diffuseColor.rgb = mix(mix(uBody, uEmblem, emblem), mapRgb, metal);
`;

/**
 * Patches `material` (the hoodie's fabric) to take its colours from the returned uniforms.
 * `uGlow` makes the emblem faintly emissive so Bloom can pick it up.
 * @param {import("three").MeshStandardMaterial} material
 */
export function tintHoodie(material) {
  const patched = material.userData.tint;
  if (patched?.uBody.value.isColor) return patched; // React runs useMemo twice in dev: the shader must keep the uniforms the caller holds
  const uniforms = { uBody: { value: new Color() }, uEmblem: { value: new Color() }, uGlow: { value: 0 } };
  material.color.set(0xffffff);
  material.userData.tint = uniforms; // also lets the browser tests read the live colours
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uBody;\nuniform vec3 uEmblem;\nuniform float uGlow;")
      .replace("#include <map_fragment>", `#include <map_fragment>\n${TINT}`)
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += uEmblem * emblem * uGlow;");
  };
  material.customProgramCacheKey = () => "hoodie-tint";
  material.needsUpdate = true;
  return uniforms;
}

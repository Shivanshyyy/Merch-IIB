// Product stills (front 3/4 + back) for every seeded colourway -> public/products/<slug>-<colourway>-<view>.webp
// All stills share one crop box, so the hoodie fills the frame and front/back crossfades keep the same scale.
import { mkdirSync, readFileSync } from "node:fs";
import sharp from "sharp";

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const RENDER = 1400; // generous framing; the crop below tightens it
const SIZE = 1000;
const MARGIN = 1.07;
const PAD = 300; // lets the crop square extend past the render edge

export async function stills({ withRenderer }) {
  const seed = JSON.parse(readFileSync("supabase/seed.json", "utf8"));
  const views = [
    { name: "front", az: 0.5, el: 0.12 },
    { name: "back", az: Math.PI, el: 0.03 }, // square-on: the name preview overlays this
  ];
  mkdirSync("public/products", { recursive: true });

  const renders = [];
  await withRenderer(async (shot) => {
    for (const product of seed.products) {
      for (const cw of product.colorways) {
        for (const v of views) {
          const { buf } = await shot({ model: "public/models/hoodie.glb", size: RENDER, az: v.az, el: v.el, fill: 0.6, body: cw.body, stitch: cw.stitch });
          renders.push({ buf, file: `public/products/${product.slug}-${slugify(cw.name)}-${v.name}.webp` });
        }
      }
    }
  });

  // Alpha bounding box of each render, then the union of all of them.
  let L = Infinity;
  let T = Infinity;
  let R = -Infinity;
  let B = -Infinity;
  for (const r of renders) {
    const { info } = await sharp(r.buf).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
    const left = -info.trimOffsetLeft;
    const top = -info.trimOffsetTop;
    L = Math.min(L, left);
    T = Math.min(T, top);
    R = Math.max(R, left + info.width);
    B = Math.max(B, top + info.height);
  }
  const side = Math.round(Math.max(R - L, B - T) * MARGIN);
  const cx = (L + R) / 2;
  const cy = (T + B) / 2;
  console.log(`union box ${R - L}x${B - T} of ${RENDER}px render -> ${side}px square crop`);

  for (const r of renders) {
    // sharp runs extract before extend, so pad in its own step first.
    const padded = await sharp(r.buf).extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    await sharp(padded)
      .extract({ left: Math.round(cx - side / 2) + PAD, top: Math.round(cy - side / 2) + PAD, width: side, height: side })
      .resize(SIZE, SIZE)
      .webp({ quality: 84, alphaQuality: 90 })
      .toFile(r.file);
    console.log(r.file);
  }
}

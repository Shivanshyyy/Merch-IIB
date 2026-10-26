// Shrinks assets-raw/hoodie.glb (43 MB) into public/models/hoodie.glb.
// Usage: node scripts/optimize-model.mjs [--ratio-body=0.3] [--error-stitches=0.00015] [--out=file.glb]
// Pipeline: flatten -> strip unused attrs -> merge stitches -> weld -> per-material simplify
//           -> drop black base-colour map -> dedup -> WebP textures (<=1024) -> meshopt.
import { mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { NodeIO, PropertyType } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  flatten,
  joinPrimitives,
  meshopt,
  prune,
  simplifyPrimitive,
  textureCompress,
  weld,
} from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const SRC = "assets-raw/hoodie.glb";
const OUT = process.argv.find((a) => a.startsWith("--out="))?.split("=")[1] ?? "public/models/hoodie.glb";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : fallback;
};

// Fraction of triangles kept per material. The 11 stitch chunks hold ~90% of the original
// triangles, but each dash is a sub-millimetre capsule: a fixed ratio shreds them into slivers.
// Stitches are therefore bounded by error (fraction of mesh radius) instead; 0.0003 is ragged,
// 0.00015 keeps the pill shape, below ~0.0001 the file passes 2 MB.
const KEEP = {
  Rib_2X2_468gsm_hoodie_end: { ratio: arg("ratio-cuffs", 0.6), error: 0.002 },
  Sweat_Rib_1X1_319gsm_hoodie: { ratio: arg("ratio-body", 0.3), error: 0.002 },
  Sweat_hood_Rib_1X1_319gsm_hood: { ratio: arg("ratio-hood", 0.7), error: 0.002 },
  stitches: { ratio: arg("ratio-stitches", 0), error: arg("error-stitches", 0.00015) },
};

// Near-black fallback if a colourway is never applied; the runtime always overrides it.
const FALLBACK_BODY = [0.035, 0.035, 0.04, 1];

const NODE_NAMES = {
  Rib_2X2_468gsm_hoodie_end: "cuffs",
  Sweat_Rib_1X1_319gsm_hoodie: "body",
  Sweat_hood_Rib_1X1_319gsm_hood: "hood",
  stitches: "stitches",
};

const triCount = (doc) =>
  doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? 0) / 3, 0), 0);

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2);

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "meshopt.decoder": MeshoptDecoder,
  "meshopt.encoder": MeshoptEncoder,
});

const doc = await io.read(SRC);
const before = triCount(doc);
console.log(`source  ${mb(statSync(SRC).size)} MB, ${before.toLocaleString()} triangles`);

// 1. Bake the node chain (Sketchfab/FBX rotations and 0.01*100 scales) so every mesh sits under the scene root.
await doc.transform(flatten());
const scene = doc.getRoot().listScenes()[0];
const identity = [0, 0, 0, 0, 0, 0, 1];
for (const node of scene.listChildren()) {
  const t = [...node.getWorldTranslation(), ...node.getWorldRotation()];
  const scale = node.getWorldScale();
  const off = t.reduce((m, v, i) => Math.max(m, Math.abs(v - identity[i])), 0);
  const scaleOff = scale.reduce((m, v) => Math.max(m, Math.abs(v - 1)), 0);
  if (off > 1e-4 || scaleOff > 1e-4) throw new Error(`Expected identity world transform, got ${node.getName()}: ${t} / ${scale}`);
  node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
}

// 2. Strip attributes no material reads (tangents are derived in-shader; fabric has one UV set in use).
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    prim.setAttribute("TANGENT", null);
    prim.setAttribute("TEXCOORD_1", null);
    if (prim.getMaterial()?.getName() === "stitches") prim.setAttribute("TEXCOORD_0", null);
  }
}

// 3. Merge the 11 stitch chunks into one primitive, then weld the chunk seams.
const stitchNodes = scene.listChildren().filter((n) => n.getMesh()?.listPrimitives()[0]?.getMaterial()?.getName() === "stitches");
const stitchPrims = stitchNodes.flatMap((n) => n.getMesh().listPrimitives());
const merged = joinPrimitives(stitchPrims);
const [keep, ...rest] = stitchNodes;
keep.getMesh().listPrimitives().forEach((p) => keep.getMesh().removePrimitive(p));
keep.getMesh().addPrimitive(merged);
for (const n of rest) {
  const m = n.getMesh();
  n.dispose();
  m.dispose();
}
await doc.transform(weld());

// 4. Per-material simplification.
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const name = prim.getMaterial().getName();
    const cfg = KEEP[name];
    if (!cfg) throw new Error(`No simplify config for material ${name}`);
    const from = prim.getIndices().getCount() / 3;
    simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: cfg.ratio, error: cfg.error, lockBorder: false });
    const to = prim.getIndices().getCount() / 3;
    console.log(`  ${name.padEnd(32)} ${from.toLocaleString().padStart(9)} -> ${to.toLocaleString().padStart(7)} tris (${((to / from) * 100).toFixed(1)}%)`);
  }
}

// 5. Clean names for the gltfjsx component, and credit the author (CC BY 4.0).
for (const node of scene.listChildren()) {
  const name = NODE_NAMES[node.getMesh().listPrimitives()[0].getMaterial().getName()];
  node.setName(name);
  node.getMesh().setName(name);
}
doc.getRoot().getAsset().copyright = "Classic Black Flame Hoodie by kril, CC BY 4.0, https://sketchfab.com/3d-models/classic-black-flame-hoodie-0fd0effa321e456cb2a7467e2899b658";

// 6. Colourways null the base map at runtime (it is near-black), so ship without it and save its 5.6 MB of VRAM.
for (const mat of doc.getRoot().listMaterials()) {
  if (mat.getName() === "stitches") continue;
  mat.setBaseColorTexture(null).setBaseColorFactor(FALLBACK_BODY);
}

// Source roughness averages ~0.3 (reads as leather/satin). Lift it into a matte 0.72-0.96 band, keeping the knit variation.
for (const tex of new Set(doc.getRoot().listMaterials().map((m) => m.getMetallicRoughnessTexture()).filter(Boolean))) {
  const matte = await sharp(Buffer.from(tex.getImage())).linear([1, 0.28, 1], [0, 184, 0]).png().toBuffer();
  tex.setImage(new Uint8Array(matte)).setMimeType("image/png");
}

await doc.transform(
  prune(),
  // Materials stay separate: colourways tint cuffs, body and hood independently.
  dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.TEXTURE] }),
  // Normal map carries the knit detail, so it keeps higher quality than the roughness map.
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024], slots: /normalTexture/, quality: 92 }),
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024], slots: /metallicRoughnessTexture/, quality: 80 }),
  meshopt({ encoder: MeshoptEncoder, level: "high", quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
);

mkdirSync(dirname(OUT), { recursive: true });
await io.write(OUT, doc);

const after = triCount(doc);
console.log(`output  ${mb(statSync(OUT).size)} MB, ${after.toLocaleString()} triangles (${((after / before) * 100).toFixed(1)}% of source)`);
console.log(statSync(OUT).size <= 4 * 1024 * 1024 ? "budget  OK (<= 4 MB)" : "budget  OVER 4 MB: raise --error-stitches / lower --ratio-body");

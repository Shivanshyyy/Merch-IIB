// Shrinks assets-raw/hoodie.glb into public/models/hoodie.glb.
// Usage: node scripts/optimize-model.mjs [--ratio=0.2] [--error=0.003] [--base-size=2048] [--out=file.glb]
// Pipeline: dequantize -> bake node transform, centre and scale -> weld -> simplify -> flatten the base map
//           (keep emblem + metal, drop the knit noise) -> matte roughness -> WebP textures -> meshopt.
import { mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { NodeIO, PropertyType } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, dequantize, flatten, getBounds, meshopt, prune, simplifyPrimitive, textureCompress, transformMesh, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const SRC = "assets-raw/hoodie.glb";
const OUT = process.argv.find((a) => a.startsWith("--out="))?.split("=")[1] ?? "public/models/hoodie.glb";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : fallback;
};

// The camera shots in src/components/home/shots.ts and the floor height are framed for a hoodie 0.64 tall.
const TARGET_HEIGHT = 0.64;
const RATIO = arg("ratio", 0.2);
const ERROR = arg("error", 0.003); // fraction of the mesh radius; the ratio normally stops first
const BASE_SIZE = arg("base-size", 2048);

// Base map: the fabric is near-black knit noise, the rest is the emblem (white) and the metal aglets/eyelets.
// Pixels below this sRGB luminance collapse to FABRIC; the runtime tints them with the colourway anyway.
const FABRIC = [20, 20, 22];
const FLATTEN_FROM = 0.25;
const FLATTEN_TO = 0.5;

const triCount = (doc) =>
  doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? 0) / 3, 0), 0);

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2);
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "meshopt.decoder": MeshoptDecoder,
  "meshopt.encoder": MeshoptEncoder,
});

const doc = await io.read(SRC);
const before = triCount(doc);
console.log(`source  ${mb(statSync(SRC).size)} MB, ${before.toLocaleString()} triangles`);

// 1. The source is quantised (14-bit positions plus a node scale). Restore real floats so simplification measures real distances.
await doc.transform(dequantize(), flatten());
const scene = doc.getRoot().listScenes()[0];
const meshNodes = scene.listChildren().filter((n) => n.getMesh());
if (meshNodes.length !== 1) throw new Error(`Expected one mesh node, got ${meshNodes.length}`);
const [node] = meshNodes;
const mesh = node.getMesh();
if (mesh.listPrimitives().length !== 1) throw new Error("Expected a single primitive");

// 2. Bake the node transform into the vertices, then centre on the origin and scale to TARGET_HEIGHT.
transformMesh(mesh, node.getWorldMatrix(), true);
node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
const { min, max } = getBounds(scene);
const s = TARGET_HEIGHT / (max[1] - min[1]);
const c = min.map((v, i) => (v + max[i]) / 2);
transformMesh(mesh, [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, -c[0] * s, -c[1] * s, -c[2] * s, 1], true);
console.log(`scale   x${s.toFixed(4)} (${(max[1] - min[1]).toFixed(3)} -> ${TARGET_HEIGHT} tall), centred`);

// 3. Weld, then simplify. The meshopt simplifier keeps UV seams intact.
await doc.transform(weld());
const prim = mesh.listPrimitives()[0];
const from = prim.getIndices().getCount() / 3;
simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: RATIO, error: ERROR, lockBorder: false });
const to = prim.getIndices().getCount() / 3;
console.log(`  simplify ${from.toLocaleString()} -> ${to.toLocaleString()} tris (${((to / from) * 100).toFixed(1)}%)`);

// 4. Clean names for the component. No author credit is written here: the source file carries none.
node.setName("hoodie");
mesh.setName("hoodie");
const material = prim.getMaterial();
material.setName("fabric");

const base = material.getBaseColorTexture();
const mr = material.getMetallicRoughnessTexture();
if (!base || !mr) throw new Error("Expected base colour and metal/roughness textures");

// 5. Roughness/metal: the source reads as satin (roughness ~0.3). Lift fabric into a matte 0.72-0.96 band, keeping the knit variation,
//    and leave the metal parts (blue channel) as they are. Metal needs the full-size map to line up with the base map.
const mrRaw = await sharp(Buffer.from(mr.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const mrOut = Buffer.from(mrRaw.data);
for (let i = 0; i < mrOut.length; i += 3) {
  if (mrOut[i + 2] < 128) mrOut[i + 1] = Math.round(mrOut[i + 1] * 0.28 + 184);
}
const mrSize = mrRaw.info.width;
const metalMask = Buffer.alloc(mrSize * mrSize);
for (let i = 0; i < metalMask.length; i++) metalMask[i] = mrRaw.data[i * 3 + 2];
mr.setImage(new Uint8Array(await sharp(mrOut, { raw: mrRaw.info }).png().toBuffer())).setMimeType("image/png");

// 6. Base map: keep the emblem and metals, flatten the fabric noise so the WebP is a few KB instead of hundreds. Metal keeps its
//    source colour exactly; everything else blends toward FABRIC by luminance.
const baseRaw = await sharp(Buffer.from(base.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: bw } = baseRaw.info;
const metalAtBase = await sharp(metalMask, { raw: { width: mrSize, height: mrSize, channels: 1 } }).resize(bw, bw, { kernel: "nearest" }).raw().toBuffer();
const baseOut = Buffer.from(baseRaw.data);
for (let p = 0; p < bw * bw; p++) {
  if (metalAtBase[p] >= 128) continue;
  const o = p * 3;
  const lum = (0.2126 * baseOut[o] + 0.7152 * baseOut[o + 1] + 0.0722 * baseOut[o + 2]) / 255;
  const k = smooth(FLATTEN_FROM, FLATTEN_TO, lum);
  for (let ch = 0; ch < 3; ch++) baseOut[o + ch] = Math.round(FABRIC[ch] + (baseOut[o + ch] - FABRIC[ch]) * k);
}
base.setImage(new Uint8Array(await sharp(baseOut, { raw: baseRaw.info }).resize(BASE_SIZE, BASE_SIZE).png().toBuffer())).setMimeType("image/png");
material.setBaseColorFactor([1, 1, 1, 1]);

await doc.transform(
  prune(),
  dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.TEXTURE] }),
  // The normal map carries the knit detail, so it keeps higher quality than the roughness map.
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [BASE_SIZE, BASE_SIZE], slots: /baseColorTexture/, quality: 92 }),
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024], slots: /normalTexture/, quality: 92 }),
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024], slots: /metallicRoughnessTexture/, quality: 80 }),
  meshopt({ encoder: MeshoptEncoder, level: "high", quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 14 }),
);

mkdirSync(dirname(OUT), { recursive: true });
await io.write(OUT, doc);

const after = triCount(doc);
console.log(`output  ${mb(statSync(OUT).size)} MB, ${after.toLocaleString()} triangles (${((after / before) * 100).toFixed(1)}% of source)`);
console.log(statSync(OUT).size <= 4 * 1024 * 1024 ? "budget  OK (<= 4 MB)" : "budget  OVER 4 MB: lower --ratio");

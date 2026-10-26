// Prints the node tree, materials and textures of a GLB. Usage: node scripts/inspect-model.mjs <file.glb>
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const doc = await io.read(process.argv[2]);
const round = (v) => +v.toFixed(3);

const walk = (n, d = 0) => {
  const m = n.getMesh();
  const prims = m ? m.listPrimitives().map((p) => `${p.getMaterial()?.getName()}:${(p.getIndices()?.getCount() ?? 0) / 3}tris`).join(",") : "";
  console.log(`${"  ".repeat(d)}${n.getName() || "(unnamed)"} ${m ? `[mesh ${prims}]` : ""} T=${n.getTranslation().map(round)} R=${n.getRotation().map(round)} S=${n.getScale().map(round)}`);
  n.listChildren().forEach((c) => walk(c, d + 1));
};
doc.getRoot().listScenes().forEach((s) => s.listChildren().forEach((c) => walk(c)));

for (const m of doc.getRoot().listMaterials()) {
  console.log("MAT", m.getName(), "base", m.getBaseColorFactor().map(round), "rough", m.getRoughnessFactor(), "metal", m.getMetallicFactor(),
    "maps", [m.getBaseColorTexture() && "base", m.getMetallicRoughnessTexture() && "mr", m.getNormalTexture() && "normal"].filter(Boolean).join("+") || "none");
}
for (const t of doc.getRoot().listTextures()) console.log("TEX", t.getMimeType(), t.getSize(), `${(t.getImage().byteLength / 1024).toFixed(0)}KB`);

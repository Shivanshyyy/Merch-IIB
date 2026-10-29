import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import config from "../next.config";

// The model is cached for a week. A browser that still holds an old model under the same address crashes the scene
// (the old file has different materials), so the address must change whenever the file does.
const file = readFileSync("public/models/hoodie.glb");

test("the model's address carries a fingerprint of the actual file, and the loading counter knows its real size", () => {
  assert.equal(config.env?.NEXT_PUBLIC_MODEL_VERSION, createHash("sha256").update(file).digest("hex").slice(0, 10));
  assert.equal(config.env?.NEXT_PUBLIC_MODEL_BYTES, String(file.length));
});

test("the model is cached for good (its address changes with it), the re-rendered stills are always revalidated", async () => {
  const rules = await config.headers?.();
  const cache = (source: string) => rules?.find((r) => r.source.startsWith(source))?.headers.find((h) => h.key === "Cache-Control")?.value;
  assert.match(cache("/models") ?? "", /max-age=604800/);
  assert.match(cache("/products") ?? "", /max-age=0, must-revalidate/);
});

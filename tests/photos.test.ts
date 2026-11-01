import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { GET } from "@/app/photos/[id]/route";
import { db, NotFoundError } from "@/lib/db";
import { BadPhotoError, normalizePhoto } from "@/lib/photo-process";

const solid = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: "#cc3322" } });
const dims = async (buf: Buffer) => {
  const { width, height, format } = await sharp(buf).metadata();
  return { width, height, format };
};

test("photos are shrunk to 1600px on the long edge, re-encoded as WebP, and never enlarged", async () => {
  const big = await normalizePhoto(await solid(3200, 2000).jpeg().toBuffer());
  assert.equal(big.mime, "image/webp");
  assert.deepEqual(await dims(big.bytes), { width: 1600, height: 1000, format: "webp" });

  const small = await normalizePhoto(await solid(300, 200).png().toBuffer());
  assert.deepEqual(await dims(small.bytes), { width: 300, height: 200, format: "webp" });
});

test("a phone photo that is stored sideways comes out upright, and its EXIF (location, camera) is dropped", async () => {
  const sideways = await solid(400, 200).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const before = await sharp(sideways).metadata();
  assert.deepEqual([before.orientation, Boolean(before.exif)], [6, true], "the fixture really is sideways and carries EXIF");
  const out = await normalizePhoto(sideways);
  assert.deepEqual(await dims(out.bytes), { width: 200, height: 400, format: "webp" });
  assert.equal((await sharp(out.bytes).metadata()).exif, undefined);
});

test("anything that isn't a JPG, PNG or WebP photo is refused, whatever the file claims to be", async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');
  const gif = await solid(20, 20).gif().toBuffer();
  for (const [what, bytes] of [["svg", svg], ["gif", gif], ["random bytes", Buffer.from("definitely not a picture")], ["empty", Buffer.alloc(0)]] as const) {
    await assert.rejects(normalizePhoto(bytes), BadPhotoError, what);
  }
});

const input = { slug: "photo-tee", name: "Photo Tee", type: "tee" as const, description: "", price_inr: 499, compare_at_inr: null, name_fee_inr: 0, colorways: [{ name: "Bone", body: "#e4dfd3", stitch: "#111111" }], sizes: ["M"], personalizable: true, active: true, sort: 9 };
const blob = (text: string) => ({ mime: "image/webp", bytes: Buffer.from(text) });

test("product photos: added in order, served, removed; hiding a product keeps them; deleting it deletes them", async () => {
  const d = db();
  const p = await d.createProduct(input);
  assert.deepEqual(p.photos, []);

  const a = await d.addProductPhoto(p.id, blob("a"));
  const b = await d.addProductPhoto(p.id, blob("b"));
  assert.deepEqual((await d.getProductById(p.id))?.photos, [a, b], "the first upload is the cover");
  assert.deepEqual((await d.listActiveProducts()).find((x) => x.slug === "photo-tee")?.photos, [a, b], "the shop sees them");
  assert.equal((await d.getPhoto(b))?.bytes.toString(), "b");

  await d.removeProductPhoto(p.id, a);
  assert.deepEqual((await d.getProductById(p.id))?.photos, [b]);
  assert.equal(await d.getPhoto(a), null);

  await d.updateProduct(p.id, { ...input, active: false });
  assert.deepEqual((await d.getProductById(p.id))?.photos, [b], "editing a product leaves its photos alone");

  await d.deleteProduct(p.id);
  assert.equal(await d.getPhoto(b), null);
  await assert.rejects(d.addProductPhoto(p.id, blob("c")), NotFoundError);
});

test("/photos/<id> serves the stored bytes with long-lived caching, and 404s for anything else", async () => {
  const d = db();
  const p = await d.createProduct({ ...input, slug: "photo-route" });
  const id = await d.addProductPhoto(p.id, blob("pixels"));
  const get = (target: string) => GET(new Request(`http://x/photos/${target}`), { params: Promise.resolve({ id: target }) });

  const ok = await get(id);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "image/webp");
  assert.match(ok.headers.get("cache-control") ?? "", /immutable/);
  assert.equal(await ok.text(), "pixels");

  assert.equal((await get("not-a-uuid")).status, 404);
  assert.equal((await get("00000000-0000-4000-8000-0000000000ff")).status, 404);
  assert.equal((await get("../../etc/passwd")).status, 404);
  await d.deleteProduct(p.id);
});

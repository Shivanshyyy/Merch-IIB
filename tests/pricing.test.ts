import assert from "node:assert/strict";
import { test } from "node:test";
import { priceOrder as price } from "@/lib/pricing";
import type { Product } from "@/lib/types";

const rules = { nameMaxLength: 12, nameUppercase: true };
const priceOrder = (lines: Parameters<typeof price>[0], products: Product[], r = rules) => price(lines, products, r);

const product = (over: Partial<Product> = {}): Product => ({
  id: "p1",
  slug: "flame",
  name: "Flame Hoodie",
  type: "hoodie",
  description: "",
  price_inr: 1000,
  colorways: [{ name: "Midnight", body: "#000", stitch: "#f00" }],
  sizes: ["S", "M"],
  personalizable: true,
  active: true,
  sort: 1,
  photos: [],
  ...over,
});

const line = (over = {}) => ({ slug: "flame", colorway: "Midnight", size: "M", name: "Aryan", qty: 2, ...over });

test("total is DB price x quantity, summed over lines", () => {
  const r = priceOrder([line(), line({ size: "S", qty: 1 })], [product()]);
  assert.ok(r.ok);
  assert.equal(r.total, 3000);
  assert.equal(r.items[0].unitPriceInr, 1000);
});

test("a price smuggled into the request is ignored", () => {
  const r = priceOrder([{ ...line(), unitPriceInr: 1, price_inr: 1, total: 1 } as never], [product()]);
  assert.ok(r.ok);
  assert.equal(r.total, 2000);
});

test("names are normalised (spacing, capitals) before they are stored", () => {
  const r = priceOrder([line({ name: "  aryan   k. " })], [product()]);
  assert.ok(r.ok);
  assert.equal(r.items[0].name, "ARYAN K.");
});

test("name rules follow the runtime settings (length and capitals)", () => {
  const long = priceOrder([line({ name: "Aryan Kumar Singh" })], [product()], { nameMaxLength: 20, nameUppercase: false });
  assert.ok(long.ok);
  assert.equal(long.items[0].name, "Aryan Kumar Singh");
  assert.throws(() => priceOrder([line({ name: "Aryan Kumar Singh" })], [product()], { nameMaxLength: 8, nameUppercase: false }));
});

test("rejects unknown product, colourway and size", () => {
  assert.equal(priceOrder([line({ slug: "ghost" })], [product()]).ok, false);
  assert.equal(priceOrder([line({ colorway: "Pink" })], [product()]).ok, false);
  assert.equal(priceOrder([line({ size: "XXL" })], [product()]).ok, false);
});

test("a name on a non-personalisable product is refused", () => {
  assert.equal(priceOrder([line()], [product({ personalizable: false })]).ok, false);
  assert.equal(priceOrder([line({ name: "" })], [product({ personalizable: false })]).ok, true);
});

test("invalid quantity or name throws instead of pricing", () => {
  assert.throws(() => priceOrder([line({ qty: 0 })], [product()]));
  assert.throws(() => priceOrder([line({ qty: 11 })], [product()]));
  assert.throws(() => priceOrder([line({ name: "A".repeat(13) })], [product()]));
  assert.throws(() => priceOrder([line({ name: "Bobby;DROP" })], [product()]));
});

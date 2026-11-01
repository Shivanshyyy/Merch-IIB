import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultSettings } from "@/config/site";
import { bestDiscount, offerHint } from "@/lib/offers";
import { priceOrder } from "@/lib/pricing";
import type { Product } from "@/lib/types";

const o = defaultSettings.offers; // 5% combo, 10% above ₹1499
const cw = [{ name: "Black", body: "#000000", stitch: "#ffffff" }];
const p = (slug: string, type: Product["type"], price: number, fee: number): Product => ({ id: slug, slug, name: slug, type, description: "", price_inr: price, compare_at_inr: null, name_fee_inr: fee, colorways: cw, sizes: ["M"], personalizable: true, active: true, sort: 1, photos: [] });
const catalog = [p("hood", "hoodie", 999, 0), p("tee", "tee", 499, 99), p("reg", "tee", 349, 99)];
const line = (slug: string, name = "", qty = 1) => ({ slug, colorway: "Black", size: "M", name, qty });
const price = (lines: ReturnType<typeof line>[]) => priceOrder(lines, catalog, { ...defaultSettings });

test("name print adds ₹99 on tees and nothing on hoodies", () => {
  const r = price([line("tee", "Aryan"), line("hood", "Aryan")]);
  assert.ok(r.ok);
  assert.equal(r.items[0].unitPriceInr, 598);
  assert.equal(r.items[0].nameFeeInr, 99);
  assert.equal(r.items[1].unitPriceInr, 999);
  const plain = price([line("tee")]);
  assert.ok(plain.ok && plain.subtotal === 499);
});

test("hoodie + tee gets the combo 5%", () => {
  const r = price([line("hood"), line("reg")]); // 1348, under the big-order line
  assert.ok(r.ok && r.discount?.percent === 5 && r.discount.amount === 67 && r.total === 1281);
});

test("above ₹1499 gets 10%, and only the bigger offer applies", () => {
  const big = price([line("hood"), line("tee")]); // 1498: combo only
  assert.ok(big.ok && big.discount?.percent === 5);
  const both = price([line("hood"), line("tee", "Sam")]); // 1597: both qualify, 10% wins
  assert.ok(both.ok && both.discount?.percent === 10 && both.discount.amount === 160 && both.total === 1437);
  const exactly = bestDiscount([{ kind: "tee", amount: 1499 }], o);
  assert.equal(exactly, null, "the threshold itself doesn't qualify");
});

test("no offer on a single kind under the threshold; the hint says how far off 10% is", () => {
  const r = price([line("tee", "", 2)]);
  assert.ok(r.ok && r.discount === null && r.total === 998);
  assert.equal(offerHint(998, null, o), "Add ₹502 more to get 10% off");
  assert.equal(offerHint(1600, { percent: 10, amount: 160, label: "" }, o), null);
});

test("offers switch off at 0%", () => {
  assert.equal(bestDiscount([{ kind: "hoodie", amount: 999 }, { kind: "tee", amount: 999 }], { comboPercent: 0, bulkAbove: 1499, bulkPercent: 0 }), null);
});

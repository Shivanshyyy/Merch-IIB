import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultSettings } from "@/config/site";
import { planOrderAction } from "@/lib/admin/order-flow";
import { discountPercent, isOnSale } from "@/lib/discount";
import { priceOrder } from "@/lib/pricing";
import { promoView } from "@/lib/promo";
import { mergeSettings } from "@/lib/settings-schema";
import type { Order, Product } from "@/lib/types";

const product = (over: Partial<Product> = {}): Product => ({ id: "p1", slug: "hood", name: "Hood", type: "hoodie", description: "", price_inr: 999, compare_at_inr: 1299, colorways: [{ name: "Black", body: "#000000", stitch: "#ffffff" }], sizes: ["M"], personalizable: true, active: true, sort: 1, photos: [], ...over });
const order = (over: Partial<Order> = {}): Order => ({
  id: "o1", code: "HD-AAAA", batch_id: "b1", user_id: "u1", email: "a@b.c", full_name: "A", phone: "9876543210", hostel: "H4", room: "1",
  items: [], total_inr: 999, utr: null, payment_status: "pending", order_status: "placed", refund_status: "none", admin_note: null, verified_at: null, freebie: false, created_at: "2026-11-01T00:00:00Z", ...over,
});
const ctx = (taken: number, enabled = true) => ({ now: new Date("2026-11-01T10:00:00Z"), products: [], rules: defaultSettings, promo: { enabled, limit: 200, taken } });

test("sale price: shown as a discount only when the original is higher", () => {
  assert.equal(discountPercent(product()), 23);
  assert.ok(!isOnSale(product({ compare_at_inr: null })));
  assert.ok(!isOnSale(product({ compare_at_inr: 999 })));
});

test("customers pay the selling price, never the original", () => {
  const r = priceOrder([{ slug: "hood", colorway: "Black", size: "M", name: "", qty: 2 }], [product()], defaultSettings);
  assert.ok(r.ok && r.total === 1998);
});

test("verifying payment claims a freebie spot while any are left", () => {
  const p = planOrderAction(order(), { type: "verify" }, ctx(37));
  assert.ok(p.ok && p.patch.freebie === true && /38\/200/.test(p.message));
  const full = planOrderAction(order(), { type: "verify" }, ctx(200));
  assert.ok(full.ok && !("freebie" in full.patch));
  const off = planOrderAction(order(), { type: "verify" }, ctx(0, false));
  assert.ok(off.ok && !("freebie" in off.patch));
});

test("rejecting or resetting a payment gives the spot back", () => {
  const paid = order({ payment_status: "verified", verified_at: "2026-11-01T10:00:00Z", freebie: true });
  for (const type of ["reject", "reset_payment"] as const) {
    const p = planOrderAction(paid, { type }, ctx(1));
    assert.ok(p.ok && p.patch.freebie === false);
  }
});

test("offer view: spots left never go below zero, and the offer can be switched off", () => {
  assert.equal(promoView(defaultSettings.promo, 250)?.left, 0);
  assert.equal(promoView(defaultSettings.promo, 12)?.left, 188);
  assert.equal(promoView({ ...defaultSettings.promo, enabled: false }, 0), null);
  assert.equal(mergeSettings({ promo: { enabled: true, limit: -5 } }).promo.limit, 200, "bad stored offer falls back to the default");
});

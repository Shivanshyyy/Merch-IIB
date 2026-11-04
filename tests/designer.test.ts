import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { COMMISSION_MAX, COMMISSION_MIN, designerSnapshot, isValidCommission, unitCommission, unitProfit } from "@/lib/designer/commission";
import { canMove, designerCanDelete, designerCanEdit, submitProblems } from "@/lib/designer/design-flow";
import { saleState, summarizeDesigner } from "@/lib/designer/sales";
import { db, NotFoundError } from "@/lib/db";
import { memoryStore } from "@/lib/db/memory";
import type { Design, Order, OrderItem, Payout, ProductTerms } from "@/lib/types";

const D1 = "d1000000-0000-4000-8000-000000000001";
const D2 = "d2000000-0000-4000-8000-000000000002";

const item = (over: Partial<OrderItem> = {}): OrderItem => ({
  slug: "lake",
  productName: "Lake Hoodie",
  colorway: "Black",
  size: "M",
  name: "",
  qty: 1,
  unitPriceInr: 999,
  designer: { id: D1, costInr: 600, pct: 7, unitCommissionInr: 27 },
  ...over,
});
const order = (over: Partial<Order> = {}): Order => ({
  id: crypto.randomUUID(),
  code: "HD-AAAA",
  batch_id: "b1",
  user_id: "u1",
  email: "buyer@example.com",
  full_name: "Buyer Name",
  phone: "9876543210",
  hostel: "H4",
  room: "12",
  items: [item()],
  total_inr: 999,
  discount_inr: 0,
  discount_label: null,
  utr: null,
  payment_status: "verified",
  order_status: "placed",
  refund_status: "none",
  admin_note: null,
  verified_at: "2026-11-01T10:00:00Z",
  freebie: false,
  created_at: "2026-11-01T09:00:00Z",
  ...over,
});
const payout = (over: Partial<Payout> = {}): Payout => ({ id: crypto.randomUUID(), designer_id: D1, amount_inr: 10, reference: null, note: null, paid_at: "2026-11-02T00:00:00Z", ...over });

// ---------- commission maths

test("commission is a whole-percent share of profit, rounded down", () => {
  assert.equal(unitProfit(999, 600), 399);
  assert.equal(unitCommission(999, 600, 7), 27); // 27.93 -> 27
  assert.equal(unitCommission(1000, 400, 10), 60);
  assert.equal(unitCommission(500, 400, 4), 4);
  assert.equal(unitCommission(100, 99, 4), 0, "tiny profit rounds to nothing");
});

test("no profit means no commission, never a negative one", () => {
  assert.equal(unitProfit(500, 700), 0);
  assert.equal(unitCommission(500, 700, 10), 0);
  assert.equal(unitCommission(500, 500, 10), 0);
});

test("the commission range is whole percents from 4 to 10", () => {
  assert.equal(COMMISSION_MIN, 4);
  assert.equal(COMMISSION_MAX, 10);
  for (const ok of [4, 5, 7, 10]) assert.ok(isValidCommission(ok), String(ok));
  for (const bad of [3, 11, 0, -5, 7.5, NaN, Infinity, "7", null, undefined]) assert.equal(isValidCommission(bad), false, String(bad));
});

test("snapshot locks cost, rate and the per-unit share; products without a designer get none", () => {
  const terms: ProductTerms = { product_id: "p1", designer_id: D1, design_id: "x", cost_inr: 600, commission_pct: 7 };
  assert.deepEqual(designerSnapshot(terms, 999), { id: D1, costInr: 600, pct: 7, unitCommissionInr: 27 });
  assert.equal(designerSnapshot(undefined, 999), undefined);
  assert.equal(designerSnapshot({ ...terms, designer_id: null }, 999), undefined);
});

// ---------- sales summary

test("sale state: counted when paid, pending while unpaid, void when cancelled or refunded", () => {
  assert.equal(saleState(order()), "counted");
  assert.equal(saleState(order({ refund_status: "requested" })), "counted", "a refund request alone doesn't remove the sale");
  assert.equal(saleState(order({ payment_status: "pending", verified_at: null })), "pending");
  assert.equal(saleState(order({ payment_status: "pending", order_status: "cancelled" })), "void");
  assert.equal(saleState(order({ payment_status: "rejected" })), "void");
  assert.equal(saleState(order({ order_status: "cancelled" })), "void");
  assert.equal(saleState(order({ refund_status: "approved" })), "void");
  assert.equal(saleState(order({ refund_status: "refunded" })), "void");
});

test("summary counts only this designer's verified items, per product", () => {
  const orders = [
    order({ items: [item({ qty: 2 }), item({ slug: "tee", productName: "Lake Tee", unitPriceInr: 499, designer: { id: D1, costInr: 300, pct: 7, unitCommissionInr: 13 } })] }),
    order({ items: [item({ slug: "other", productName: "Someone Else", designer: { id: D2, costInr: 1, pct: 10, unitCommissionInr: 99 } }), item({ slug: "house", productName: "House Hoodie", designer: undefined })] }),
    order({ payment_status: "pending", verified_at: null, items: [item({ qty: 3 })] }),
    order({ order_status: "cancelled", items: [item({ qty: 5 })] }),
    order({ refund_status: "refunded", items: [item({ qty: 4 })] }),
  ];
  const s = summarizeDesigner(orders, D1, [payout({ amount_inr: 30 }), payout({ designer_id: D2, amount_inr: 999 })]);
  assert.equal(s.unitsSold, 3);
  assert.equal(s.unitsPending, 3);
  assert.equal(s.earnedInr, 2 * 27 + 13);
  assert.equal(s.paidInr, 30, "other designers' payouts are ignored");
  assert.equal(s.balanceInr, 67 - 30);
  assert.deepEqual(
    s.byProduct.map((p) => [p.slug, p.units, p.earnedInr, p.pendingUnits]),
    [
      ["lake", 2, 54, 3],
      ["tee", 1, 13, 0],
    ],
  );
  assert.equal(s.sales.length, 5, "includes pending and void lines for the history");
  assert.deepEqual(new Set(s.sales.map((x) => x.state)), new Set(["counted", "pending", "void"]));
});

test("what a designer sees about a sale never includes the buyer or the order code", () => {
  const s = summarizeDesigner([order({ items: [item({ name: "SECRET NAME" })] })], D1, []);
  const text = JSON.stringify(s);
  for (const leak of ["buyer@example.com", "Buyer Name", "9876543210", "HD-AAAA", "SECRET NAME", "H4", "999"]) assert.equal(text.includes(leak), false, `leaked ${leak}`);
  assert.deepEqual(Object.keys(s.sales[0]).sort(), ["colorway", "commissionInr", "date", "productName", "qty", "size", "slug", "state"]);
});

test("a refund after a payout can push the balance below zero", () => {
  const s = summarizeDesigner([order({ refund_status: "refunded" })], D1, [payout({ amount_inr: 27 })]);
  assert.equal(s.earnedInr, 0);
  assert.equal(s.balanceInr, -27);
});

test("an empty history is all zeros", () => {
  const s = summarizeDesigner([], D1, []);
  assert.deepEqual([s.unitsSold, s.unitsPending, s.earnedInr, s.paidInr, s.balanceInr, s.byProduct.length, s.sales.length], [0, 0, 0, 0, 0, 0, 0]);
});

// ---------- design workflow

test("designs move draft -> review -> approved -> live -> retired, and no other way", () => {
  assert.ok(canMove("draft", "in_review"));
  assert.ok(canMove("in_review", "approved"));
  assert.ok(canMove("in_review", "changes_requested"));
  assert.ok(canMove("in_review", "rejected"));
  assert.ok(canMove("changes_requested", "in_review"));
  assert.ok(canMove("approved", "live"));
  assert.ok(canMove("live", "retired"));
  assert.equal(canMove("draft", "live"), false, "can't skip review");
  assert.equal(canMove("draft", "approved"), false);
  assert.equal(canMove("in_review", "live"), false, "must be approved before it goes live");
  assert.equal(canMove("rejected", "in_review"), false);
  assert.equal(canMove("retired", "live"), false);
  assert.equal(canMove("live", "draft"), false);
});

test("a designer can edit only while the design is theirs to work on", () => {
  for (const s of ["draft", "changes_requested"] as const) assert.ok(designerCanEdit(s), s);
  for (const s of ["in_review", "approved", "rejected", "live", "retired"] as const) assert.equal(designerCanEdit(s), false, s);
  assert.ok(designerCanDelete("draft"));
  for (const s of ["in_review", "changes_requested", "approved", "rejected", "live", "retired"] as const) assert.equal(designerCanDelete(s), false, s);
});

test("submitting needs a title, an image, a colour and the originality confirmation", () => {
  const ready = { title: "Lake", images: ["i1"], colorways: [{ name: "Black", body: "#000000", stitch: "#ffffff" }], originality_confirmed_at: "2026-11-01T00:00:00Z" };
  assert.deepEqual(submitProblems(ready), []);
  assert.equal(submitProblems({ ...ready, title: " " }).length, 1);
  assert.equal(submitProblems({ ...ready, images: [] }).length, 1);
  assert.equal(submitProblems({ ...ready, colorways: [] }).length, 1);
  assert.equal(submitProblems({ ...ready, originality_confirmed_at: null }).length, 1);
  assert.equal(submitProblems({ title: "", images: [], colorways: [], originality_confirmed_at: null }).length, 4);
});

// ---------- in-memory database

const newDesign = (over: Partial<Design> = {}) => ({ title: "Lake", description: "", product_type: "hoodie" as const, colorways: [], suggested_price_inr: null, print_file_url: null, ...over });

beforeEach(async () => {
  await db().listActiveProducts();
  const s = memoryStore();
  s.profiles.length = 0;
  s.designers.length = 0;
  s.designs.length = 0;
  s.productTerms.length = 0;
  s.payouts.length = 0;
  s.orders.length = 0;
  s.designImageData = {};
  s.profiles.push(
    { id: D1, email: "d1@example.com", full_name: "Dee One", phone: "9000000001", roll_no: null, default_size: null, created_at: "2026-10-01T00:00:00Z" },
    { id: D2, email: "d2@example.com", full_name: "Dee Two", phone: "9000000002", roll_no: null, default_size: null, created_at: "2026-10-02T00:00:00Z" },
  );
});

test("designers start pending, need a profile, and are decided by the admin", async () => {
  const d = db();
  await assert.rejects(d.createDesigner("00000000-0000-4000-8000-0000000000ff", { bio: null, upi_id: null }), NotFoundError);
  const created = await d.createDesigner(D1, { bio: "Posters", upi_id: "dee@upi" });
  assert.equal(created.status, "pending");
  assert.equal(created.commission_pct, null);
  await assert.rejects(d.createDesigner(D1, { bio: null, upi_id: null }), /already exists/);
  await assert.rejects(d.decideDesigner(D1, { status: "approved", commission_pct: null, decision_note: null }), /commission/);

  const approved = await d.decideDesigner(D1, { status: "approved", commission_pct: 6, decision_note: "Welcome" });
  assert.deepEqual([approved.status, approved.commission_pct, approved.decision_note], ["approved", 6, "Welcome"]);
  assert.ok(approved.decided_at);

  await d.createDesigner(D2, { bio: null, upi_id: null });
  assert.deepEqual((await d.listDesigners("pending")).map((x) => x.email), ["d2@example.com"]);
  const all = await d.listDesigners();
  assert.equal(all.length, 2);
  assert.deepEqual(
    all.map((x) => x.full_name).sort(),
    ["Dee One", "Dee Two"],
    "the list carries name, email and phone from the profile",
  );
  await assert.rejects(d.decideDesigner("00000000-0000-4000-8000-0000000000ff", { status: "rejected", commission_pct: null, decision_note: null }), NotFoundError);
});

test("designs: create, edit, images in order, delete takes the images along", async () => {
  const d = db();
  await d.createDesigner(D1, { bio: null, upi_id: null });
  await assert.rejects(d.createDesign(D2, newDesign()), NotFoundError, "only designers can have designs");

  const design = await d.createDesign(D1, newDesign());
  assert.deepEqual([design.status, design.images, design.originality_confirmed_at], ["draft", [], null]);

  const a = await d.addDesignImage(design.id, { mime: "image/webp", bytes: Buffer.from("a") });
  const b = await d.addDesignImage(design.id, { mime: "image/webp", bytes: Buffer.from("b") });
  assert.deepEqual((await d.getDesign(design.id))?.images, [a, b]);
  assert.equal((await d.getDesignImage(a))?.designId, design.id, "the image knows its owner for the access check");
  assert.equal(await d.getDesignImage("nope"), null);

  const patched = await d.patchDesign(design.id, { title: "Lake at night", status: "in_review", submitted_at: "2026-11-02T00:00:00Z" });
  assert.deepEqual([patched.title, patched.status], ["Lake at night", "in_review"]);
  assert.equal(patched.description, "", "keys not in the patch are untouched");
  await assert.rejects(d.patchDesign("nope", { title: "x" }), NotFoundError);

  await d.removeDesignImage(design.id, a);
  assert.deepEqual((await d.getDesign(design.id))?.images, [b]);
  assert.equal(await d.getDesignImage(a), null);

  await d.deleteDesign(design.id);
  assert.equal(await d.getDesign(design.id), null);
  assert.equal(await d.getDesignImage(b), null);
});

test("designs list by designer and by status, newest submission first", async () => {
  const d = db();
  await d.createDesigner(D1, { bio: null, upi_id: null });
  await d.createDesigner(D2, { bio: null, upi_id: null });
  const a = await d.createDesign(D1, newDesign({ title: "A" }));
  const b = await d.createDesign(D1, newDesign({ title: "B" }));
  await d.createDesign(D2, newDesign({ title: "C" }));
  await d.patchDesign(a.id, { status: "in_review", submitted_at: "2026-11-01T00:00:00Z" });
  await d.patchDesign(b.id, { status: "in_review", submitted_at: "2026-11-03T00:00:00Z" });

  assert.equal((await d.listDesignsByDesigner(D1)).length, 2);
  assert.equal((await d.listDesignsByDesigner(D2)).length, 1);
  assert.deepEqual((await d.listDesigns("in_review")).map((x) => x.title), ["B", "A"]);
  assert.equal((await d.listDesigns()).length, 3);
});

test("product terms are saved apart from the product, and go with it", async () => {
  const d = db();
  const [product] = await d.listAllProducts();
  await assert.rejects(d.saveProductTerms({ product_id: "nope", designer_id: null, design_id: null, cost_inr: 1, commission_pct: 5 }), NotFoundError);
  await d.saveProductTerms({ product_id: product.id, designer_id: D1, design_id: null, cost_inr: 500, commission_pct: 5 });
  await d.saveProductTerms({ product_id: product.id, designer_id: D1, design_id: null, cost_inr: 450, commission_pct: 8 });
  assert.equal((await d.listProductTerms()).length, 1, "saving twice updates, not duplicates");
  assert.deepEqual((await d.getProductTerms(product.id))?.commission_pct, 8);
  assert.equal(JSON.stringify(await d.getProductBySlug(product.slug)).includes("cost_inr"), false, "the shop's product never carries cost");

  await d.deleteProduct(product.id);
  assert.equal(await d.getProductTerms(product.id), null);
});

test("deleting a live design's product retires the design", async () => {
  const d = db();
  await d.createDesigner(D1, { bio: null, upi_id: null });
  const [product] = await d.listAllProducts();
  const design = await d.createDesign(D1, newDesign());
  await d.patchDesign(design.id, { status: "live", product_id: product.id });
  await d.deleteProduct(product.id);
  const after = await d.getDesign(design.id);
  assert.deepEqual([after?.status, after?.product_id], ["retired", null]);
});

test("a designer's orders are found by the id snapshotted on the items", async () => {
  const d = db();
  const s = memoryStore();
  s.orders.push(order({ code: "HD-ONE" }), order({ code: "HD-TWO", items: [item({ designer: undefined })] }), order({ code: "HD-THREE", items: [item({ designer: { id: D2, costInr: 1, pct: 4, unitCommissionInr: 1 } })] }));
  assert.deepEqual((await d.listOrdersWithDesigner(D1)).map((o) => o.code), ["HD-ONE"]);
  assert.deepEqual((await d.listOrdersWithDesigner(D2)).map((o) => o.code), ["HD-THREE"]);
});

test("payouts: record, list newest first, filter by designer, delete", async () => {
  const d = db();
  await d.createDesigner(D1, { bio: null, upi_id: null });
  await d.createDesigner(D2, { bio: null, upi_id: null });
  await assert.rejects(d.createPayout({ designer_id: "nope", amount_inr: 10, reference: null, note: null }), NotFoundError);
  const p1 = await d.createPayout({ designer_id: D1, amount_inr: 100, reference: "UTR1", note: null });
  await d.createPayout({ designer_id: D2, amount_inr: 50, reference: null, note: "cash" });
  assert.equal((await d.listPayouts()).length, 2);
  assert.deepEqual((await d.listPayouts(D1)).map((p) => p.reference), ["UTR1"]);
  await d.deletePayout(p1.id);
  assert.equal((await d.listPayouts(D1)).length, 0);
});

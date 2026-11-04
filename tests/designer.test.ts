import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { canPublish, commissionPreview, payoutProblem, planDesignerAction, planDesignReview, uniqueSlug } from "@/lib/admin/designer-flow";
import { COMMISSION_MAX, COMMISSION_MIN, designerSnapshot, isValidCommission, pieceBreakdown, unitCommission, unitProfit } from "@/lib/designer/commission";
import { canMove, designerCanDelete, designerCanEdit, submitProblems } from "@/lib/designer/design-flow";
import { saleState, summarizeDesigner, summarizeProfit } from "@/lib/designer/sales";
import { publishSchema } from "@/lib/admin/schemas";
import { bioSchema, designerApplySchema, designerSignUpSchema, designSchema, toDesignInput, upiIdSchema } from "@/lib/designer/schemas";
import { db, NotFoundError } from "@/lib/db";
import { placeOrderFor } from "@/lib/orders/place-order";
import { toOrderView } from "@/lib/orders/view";
import { memoryStore } from "@/lib/db/memory";
import type { Design, Designer, Order, OrderItem, Payout, ProductTerms } from "@/lib/types";

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
  designer: { id: D1, productId: "p-lake", costInr: 600, pct: 7, unitCommissionInr: 27 },
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
  const terms: ProductTerms = { product_id: "p1", designer_id: D1, design_id: "x", cost_inr: 600, vendor_cost_inr: 550, packaging_cost_inr: 50, commission_pct: null };
  assert.deepEqual(designerSnapshot(terms, 7, 999), { id: D1, productId: "p1", costInr: 600, pct: 7, unitCommissionInr: 27 }, "the designer's rate applies by default");
  assert.deepEqual(designerSnapshot({ ...terms, commission_pct: 10 }, 7, 999), { id: D1, productId: "p1", costInr: 600, pct: 10, unitCommissionInr: 39 }, "a product's own rate wins");
  assert.equal(designerSnapshot(terms, null, 999), undefined, "no rate yet, no share");
  assert.equal(designerSnapshot(undefined, 7, 999), undefined);
  assert.equal(designerSnapshot({ ...terms, designer_id: null }, 7, 999), undefined);
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
    order({ items: [item({ qty: 2 }), item({ slug: "tee", productName: "Lake Tee", unitPriceInr: 499, designer: { id: D1, productId: "p-tee", costInr: 300, pct: 7, unitCommissionInr: 13 } })] }),
    order({ items: [item({ slug: "other", productName: "Someone Else", designer: { id: D2, productId: "p-other", costInr: 1, pct: 10, unitCommissionInr: 99 } }), item({ slug: "house", productName: "House Hoodie", designer: undefined })] }),
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
    s.byProduct.map((p) => [p.productId, p.units, p.earnedInr, p.pendingUnits]),
    [
      ["p-lake", 2, 54, 3],
      ["p-tee", 1, 13, 0],
    ],
  );
  assert.equal(s.sales.length, 5, "includes pending and void lines for the history");
  assert.deepEqual(new Set(s.sales.map((x) => x.state)), new Set(["counted", "pending", "void"]));
});

test("what a designer sees about a sale never includes the buyer or the order code", () => {
  const s = summarizeDesigner([order({ items: [item({ name: "SECRET NAME" })] })], D1, []);
  const text = JSON.stringify(s);
  for (const leak of ["buyer@example.com", "Buyer Name", "9876543210", "HD-AAAA", "SECRET NAME", "H4", "999"]) assert.equal(text.includes(leak), false, `leaked ${leak}`);
  assert.deepEqual(Object.keys(s.sales[0]).sort(), ["colorway", "commissionInr", "date", "productId", "productName", "qty", "size", "state"]);
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

// ---------- admin decisions

const designer = (over: Partial<Designer> = {}): Designer => ({ id: D1, bio: null, upi_id: null, status: "pending", commission_pct: null, decision_note: null, decided_at: null, created_at: "2026-10-01T00:00:00Z", ...over });
const aDesign = (over: Partial<Design> = {}): Design => ({
  id: "g1",
  designer_id: D1,
  title: "Lake",
  description: "",
  product_type: "hoodie",
  colorways: [{ name: "Black", body: "#0E0E10", stitch: "#FFFFFF" }],
  suggested_price_inr: null,
  print_file_url: null,
  originality_confirmed_at: "2026-11-01T00:00:00Z",
  status: "in_review",
  review_note: null,
  submitted_at: "2026-11-01T00:00:00Z",
  reviewed_at: null,
  product_id: null,
  images: ["i1"],
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
  ...over,
});
const now = new Date("2026-11-04T10:00:00Z");

test("approving a designer needs a 4-10% commission and a pending or rejected application", () => {
  const ok = planDesignerAction(designer(), { type: "approve", commission: 6, note: "  Welcome  " });
  assert.ok(ok.ok);
  assert.deepEqual(ok.decision, { status: "approved", commission_pct: 6, decision_note: "Welcome" });
  for (const bad of [3, 11, 5.5, NaN]) assert.equal(planDesignerAction(designer(), { type: "approve", commission: bad }).ok, false, String(bad));
  assert.ok(planDesignerAction(designer({ status: "rejected" }), { type: "approve", commission: 4 }).ok, "a rejected applicant can be reconsidered");
  assert.equal(planDesignerAction(designer({ status: "approved", commission_pct: 5 }), { type: "approve", commission: 6 }).ok, false, "already approved");
  assert.equal(planDesignerAction(designer({ status: "suspended", commission_pct: 5 }), { type: "approve", commission: 6 }).ok, false, "use reinstate");
});

test("reject, suspend and reinstate follow the account's status", () => {
  assert.ok(planDesignerAction(designer(), { type: "reject", note: "Not a fit" }).ok);
  assert.equal(planDesignerAction(designer({ status: "approved", commission_pct: 5 }), { type: "reject" }).ok, false, "suspend instead");

  const approved = designer({ status: "approved", commission_pct: 7, decision_note: "Welcome" });
  const sus = planDesignerAction(approved, { type: "suspend", note: "Paused" });
  assert.ok(sus.ok);
  assert.deepEqual(sus.decision, { status: "suspended", commission_pct: 7, decision_note: "Paused" }, "suspending keeps the rate");
  assert.equal(planDesignerAction(designer(), { type: "suspend" }).ok, false);

  const back = planDesignerAction(designer({ status: "suspended", commission_pct: 7, decision_note: "Paused" }), { type: "reinstate" });
  assert.ok(back.ok);
  assert.deepEqual(back.decision, { status: "approved", commission_pct: 7, decision_note: null });
  assert.equal(planDesignerAction(approved, { type: "reinstate" }).ok, false);
  assert.equal(planDesignerAction(designer({ status: "suspended", commission_pct: null }), { type: "reinstate" }).ok, false);
});

test("the commission can be changed only for approved or suspended designers, within range", () => {
  const approved = designer({ status: "approved", commission_pct: 5, decision_note: "Hi" });
  const r = planDesignerAction(approved, { type: "set_commission", commission: 9 });
  assert.ok(r.ok);
  assert.deepEqual(r.decision, { status: "approved", commission_pct: 9, decision_note: "Hi" });
  assert.equal(planDesignerAction(approved, { type: "set_commission", commission: 12 }).ok, false);
  assert.equal(planDesignerAction(designer(), { type: "set_commission", commission: 5 }).ok, false, "pending: set it on approval");
});

test("design review: approve from review; changes and rejection need a reason", () => {
  const a = planDesignReview(aDesign(), { type: "approve" }, now);
  assert.ok(a.ok);
  assert.deepEqual(a.patch, { status: "approved", review_note: null, reviewed_at: now.toISOString() });
  const c = planDesignReview(aDesign(), { type: "changes", note: " Make the logo bigger " }, now);
  assert.ok(c.ok);
  assert.deepEqual([c.patch.status, c.patch.review_note], ["changes_requested", "Make the logo bigger"]);
  assert.equal(planDesignReview(aDesign(), { type: "changes", note: "  " }, now).ok, false);
  assert.equal(planDesignReview(aDesign(), { type: "reject", note: "" }, now).ok, false);
  assert.ok(planDesignReview(aDesign(), { type: "reject", note: "Copied artwork" }, now).ok);
  for (const status of ["draft", "changes_requested", "rejected", "live", "retired"] as const) assert.equal(planDesignReview(aDesign({ status }), { type: "approve" }, now).ok, false, `approve from ${status}`);
  assert.ok(planDesignReview(aDesign({ status: "approved" }), { type: "changes", note: "One more tweak" }, now).ok, "approved designs can still be sent back");
});

test("publishing needs an approved design with images and colours, by an approved designer", () => {
  const ok = designer({ status: "approved", commission_pct: 6 });
  assert.equal(canPublish(aDesign({ status: "approved" }), ok), null);
  assert.ok(canPublish(aDesign({ status: "in_review" }), ok));
  assert.ok(canPublish(aDesign({ status: "approved", colorways: [] }), ok));
  assert.ok(canPublish(aDesign({ status: "approved", images: [] }), ok));
  assert.ok(canPublish(aDesign({ status: "approved" }), designer({ status: "suspended", commission_pct: 6 })));
  assert.ok(canPublish(aDesign({ status: "approved" }), null));
});

test("slugs are made unique, and the commission preview matches the engine", () => {
  assert.equal(uniqueSlug("Lake at Night!", []), "lake-at-night");
  assert.equal(uniqueSlug("Lake", ["lake"]), "lake-2");
  assert.equal(uniqueSlug("Lake", ["lake", "lake-2", "lake-3"]), "lake-4");
  assert.equal(uniqueSlug("!!!", []), "design");
  assert.ok(uniqueSlug("x".repeat(100), []).length <= 56);
  assert.deepEqual(commissionPreview(999, 600, 7), { profit: 399, commission: 27 });
  assert.deepEqual(commissionPreview(500, 700, 10), { profit: 0, commission: 0 });
});

test("a payout can't exceed the balance or be a fraction", () => {
  assert.equal(payoutProblem({ balanceInr: 100 }, 100), null);
  assert.equal(payoutProblem({ balanceInr: 100 }, 1), null);
  assert.ok(payoutProblem({ balanceInr: 100 }, 101));
  assert.ok(payoutProblem({ balanceInr: 100 }, 0));
  assert.ok(payoutProblem({ balanceInr: 100 }, 10.5));
  assert.ok(payoutProblem({ balanceInr: -27 }, 5), "nothing is owed after a refund beyond the payout");
});

// ---------- form schemas

test("UPI ID is optional but must look like name@bank when given", () => {
  assert.equal(upiIdSchema.parse("  dee@okbank "), "dee@okbank");
  assert.equal(upiIdSchema.parse("dee.one-1@ybl"), "dee.one-1@ybl");
  assert.equal(upiIdSchema.parse(""), null);
  assert.equal(upiIdSchema.parse("   "), null);
  for (const bad of ["dee", "@bank", "dee@", "dee bank@x", "dee@bank@x", "a".repeat(70) + "@ybl"]) assert.equal(upiIdSchema.safeParse(bad).success, false, bad);
});

test("bio is trimmed, optional and capped at 300 characters", () => {
  assert.equal(bioSchema.parse("  Posters  "), "Posters");
  assert.equal(bioSchema.parse(""), null);
  assert.equal(bioSchema.safeParse("x".repeat(301)).success, false);
  assert.equal(bioSchema.safeParse("x".repeat(300)).success, true);
});

test("designer sign-up needs the terms ticked and the usual account fields", () => {
  const ok = { fullName: "Dee Signer", email: " Dee@Example.com ", phone: "+91 98765 43210", password: "password123", bio: "", upiId: "", agree: true };
  const parsed = designerSignUpSchema.safeParse(ok);
  assert.ok(parsed.success);
  assert.deepEqual([parsed.data.email, parsed.data.phone, parsed.data.bio, parsed.data.upiId], ["dee@example.com", "9876543210", null, null]);
  assert.equal(designerSignUpSchema.safeParse({ ...ok, agree: false }).success, false);
  assert.equal(designerSignUpSchema.safeParse({ ...ok, password: "short" }).success, false);
  assert.equal(designerSignUpSchema.safeParse({ ...ok, phone: "12345" }).success, false);
  assert.equal(designerApplySchema.safeParse({ bio: "", upiId: "", agree: false }).success, false);
  assert.ok(designerApplySchema.safeParse({ bio: "", upiId: "", agree: true }).success);
});

const design = { title: "  Lake at night ", description: " Moody. ", productType: "hoodie", colours: ["Black", "Navy Blue", "Black"], suggestedPrice: "899", printFileUrl: "", originality: true };

test("design details are trimmed, de-duplicated and turned into the stored shape", () => {
  const parsed = designSchema.safeParse(design);
  assert.ok(parsed.success);
  assert.deepEqual(toDesignInput(parsed.data), {
    title: "Lake at night",
    description: "Moody.",
    product_type: "hoodie",
    colorways: [
      { name: "Black", body: "#0E0E10", stitch: "#FFFFFF" },
      { name: "Navy Blue", body: "#1B2A4E", stitch: "#FFFFFF" },
    ],
    suggested_price_inr: 899,
    print_file_url: null,
  });
});

test("design details reject bad titles, garments, colours, prices and links", () => {
  const bad = (over: object) => designSchema.safeParse({ ...design, ...over }).success;
  assert.equal(bad({ title: "x" }), false);
  assert.equal(bad({ title: "x".repeat(61) }), false);
  assert.equal(bad({ productType: "cap" }), false);
  assert.equal(bad({ colours: ["Hot Pink"] }), false, "only palette colours");
  assert.equal(bad({ colours: ["Black", "White", "Grey", "Olive", "Beige"] }), false, "at most four");
  assert.equal(bad({ colours: [] }), true, "a draft may have no colour yet");
  for (const price of ["99", "10000", "9.5", "-1", "abc", "1e3"]) assert.equal(bad({ suggestedPrice: price }), false, price);
  assert.equal(bad({ suggestedPrice: "" }), true);
  assert.equal(bad({ printFileUrl: "http://example.com/a.png" }), false, "https only");
  assert.equal(bad({ printFileUrl: "javascript:alert(1)" }), false);
  assert.equal(bad({ printFileUrl: "not a url" }), false);
  assert.equal(bad({ printFileUrl: "https://drive.google.com/file/d/abc" }), true);
  assert.equal(bad({ description: "x".repeat(601) }), false);
});

// ---------- in-memory database

const scratchProduct = (slug: string) => db().createProduct({ slug, name: "Scratch", type: "hoodie", description: "", price_inr: 700, compare_at_inr: null, name_fee_inr: 0, colorways: [{ name: "Black", body: "#000000", stitch: "#ffffff" }], sizes: ["M"], personalizable: true, active: true, sort: 99 });
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
  const product = await scratchProduct("scratch-terms");
  await assert.rejects(d.saveProductTerms({ product_id: "nope", designer_id: null, design_id: null, cost_inr: 1, vendor_cost_inr: 1, packaging_cost_inr: 0, commission_pct: 5 }), NotFoundError);
  await d.saveProductTerms({ product_id: product.id, designer_id: D1, design_id: null, cost_inr: 500, vendor_cost_inr: 450, packaging_cost_inr: 50, commission_pct: 5 });
  await d.saveProductTerms({ product_id: product.id, designer_id: D1, design_id: null, cost_inr: 450, vendor_cost_inr: 400, packaging_cost_inr: 50, commission_pct: 8 });
  assert.equal((await d.listProductTerms()).length, 1, "saving twice updates, not duplicates");
  assert.deepEqual((await d.getProductTerms(product.id))?.commission_pct, 8);
  assert.equal(JSON.stringify(await d.getProductBySlug(product.slug)).includes("cost_inr"), false, "the shop's product never carries cost");

  await d.deleteProduct(product.id);
  assert.equal(await d.getProductTerms(product.id), null);
});

test("deleting a live design's product retires the design", async () => {
  const d = db();
  await d.createDesigner(D1, { bio: null, upi_id: null });
  const product = await scratchProduct("scratch-live");
  const design = await d.createDesign(D1, newDesign());
  await d.patchDesign(design.id, { status: "live", product_id: product.id });
  await d.deleteProduct(product.id);
  const after = await d.getDesign(design.id);
  assert.deepEqual([after?.status, after?.product_id], ["retired", null]);
});

test("a designer's orders are found by the id snapshotted on the items", async () => {
  const d = db();
  const s = memoryStore();
  s.orders.push(order({ code: "HD-ONE" }), order({ code: "HD-TWO", items: [item({ designer: undefined })] }), order({ code: "HD-THREE", items: [item({ designer: { id: D2, productId: "p-other", costInr: 1, pct: 4, unitCommissionInr: 1 } })] }));
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

// ---------- selling a designer's product

const buyer = { id: "b1000000-0000-4000-8000-000000000001", email: "buyer@example.com", name: "Buyer" };

async function designerWithProduct(rate: number | null, override: number | null = null) {
  const d = db();
  await d.createDesigner(D1, { bio: null, upi_id: null });
  if (rate !== null) await d.decideDesigner(D1, { status: "approved", commission_pct: rate, decision_note: null });
  const product = (await d.listAllProducts()).find((p) => p.slug === "iit-bombay-hoodie")!;
  await d.saveProductTerms({ product_id: product.id, designer_id: D1, design_id: null, cost_inr: 500, vendor_cost_inr: 450, packaging_cost_inr: 50, commission_pct: override });
  return product;
}
const buy = () => placeOrderFor(buyer, { values: { fullName: "Buyer", phone: "9876543210", hostel: "H4", room: "1" }, items: [{ slug: "iit-bombay-hoodie", colorway: "Black", size: "M", name: "ARYAN", qty: 2 }], confirmSpelling: true, confirmPolicy: true });

test("an order for a designer's product locks their share, and costs the buyer the same", async () => {
  const product = await designerWithProduct(6);
  const r = await buy();
  assert.equal(r.ok, true, r.message);
  const o = memoryStore().orders[0];
  assert.deepEqual(o.items[0].designer, { id: D1, productId: product.id, costInr: 500, pct: 6, unitCommissionInr: 17 }, "6% of (799 - 500) = 17.9, rounded down; the name fee isn't profit");
  assert.equal(o.total_inr, (799 + 99) * 2 - 180, "the buyer's total is unchanged by the commission");
});

test("a product's own rate beats the designer's, and no rate means no share", async () => {
  await designerWithProduct(6, 10);
  await buy();
  assert.equal(memoryStore().orders[0].items[0].designer?.pct, 10);

  memoryStore().orders.length = 0;
  memoryStore().productTerms.length = 0;
  memoryStore().designers.length = 0;
  await designerWithProduct(null); // pending designer with no rate yet
  await buy();
  assert.equal(memoryStore().orders[0].items[0].designer, undefined);
});

test("products without terms get no designer share", async () => {
  await buy();
  assert.equal(memoryStore().orders[0].items[0].designer, undefined);
});

test("a later rate change doesn't touch an order already placed", async () => {
  await designerWithProduct(5);
  await buy();
  await db().decideDesigner(D1, { status: "approved", commission_pct: 10, decision_note: null });
  assert.equal(memoryStore().orders[0].items[0].designer?.pct, 5);
  await buy();
  assert.equal(memoryStore().orders[1].items[0].designer?.pct, 10, "new orders use the new rate");
});

test("the commission counts once the payment is verified and drops out on a refund", async () => {
  await designerWithProduct(6);
  await buy();
  const d = db();
  const [placed] = await d.listOrdersWithDesigner(D1);
  const sum = async () => summarizeDesigner(await d.listOrdersWithDesigner(D1), D1, []);

  let s = await sum();
  assert.deepEqual([s.unitsSold, s.unitsPending, s.earnedInr], [0, 2, 0], "unpaid: pending, not earned");
  await d.patchOrder(placed.id, { payment_status: "verified", verified_at: now.toISOString() }, { type: "payment_verified" });
  s = await sum();
  assert.deepEqual([s.unitsSold, s.unitsPending, s.earnedInr], [2, 0, 34]);
  await d.patchOrder(placed.id, { refund_status: "refunded" }, { type: "refund_refunded" });
  s = await sum();
  assert.deepEqual([s.unitsSold, s.earnedInr], [0, 0], "refunded: no longer counts");
});

test("customers never get the designer's cost or commission in their order view", async () => {
  await designerWithProduct(6);
  await buy();
  const view = toOrderView(memoryStore().orders[0]);
  const text = JSON.stringify(view);
  for (const leak of ["designer", "costInr", "unitCommissionInr", "pct", D1]) assert.equal(text.includes(leak), false, `leaked ${leak}`);
  assert.equal(view.items[0].unitPriceInr, 898, "everything a customer needs is still there");
  assert.equal(view.code, memoryStore().orders[0].code);
});

test("a piece's money: vendor + packaging come off the price, the designer gets a share of the rest", () => {
  assert.deepEqual(pieceBreakdown(899, 450, 50, 6), { cost: 500, profit: 399, commission: 23, keep: 376 });
  assert.deepEqual(pieceBreakdown(400, 380, 50, 10), { cost: 430, profit: 0, commission: 0, keep: 0 }, "no profit, nothing owed");
});

test("publishing needs vendor + packaging below the price; packaging is a separate field", () => {
  const base = { name: "Lake", slug: "lake", description: "", price_inr: 899, vendor_cost_inr: 450, packaging_cost_inr: 50, name_fee_inr: 0, sizes: ["M"], commission: null };
  assert.equal(publishSchema.safeParse(base).success, true);
  assert.equal(publishSchema.safeParse({ ...base, packaging_cost_inr: 449 }).success, false, "450 + 449 is the price");
  assert.equal(publishSchema.safeParse({ ...base, packaging_cost_inr: -1 }).success, false);
});

test("the admin's profit summary: profit, the designer's cut and what the store keeps, counted sales only", async () => {
  await designerWithProduct(6);
  await buy();
  const d = db();
  const [placed] = await d.listOrdersWithDesigner(D1);
  assert.equal(summarizeProfit([placed], D1).total.units, 0, "unpaid orders are not counted");
  await d.patchOrder(placed.id, { payment_status: "verified", verified_at: now.toISOString() }, { type: "payment_verified" });
  const { total } = summarizeProfit(await d.listOrdersWithDesigner(D1), D1);
  assert.equal(total.profitInr, total.revenueInr - total.costInr);
  assert.equal(total.keepInr, total.profitInr - total.commissionInr);
  assert.equal(total.commissionInr, 34);
});

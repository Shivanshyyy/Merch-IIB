import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { defaultSettings } from "@/config/site";
import { fromIstInput, toIstInput } from "@/lib/admin/dates";
import { pivot, toCsv, vendorRows } from "@/lib/admin/export";
import { planOrderAction, type OrderAction } from "@/lib/admin/order-flow";
import { computeStats } from "@/lib/admin/stats";
import { adminConfig, safeAdminNext, signAdminToken, verifyAdminToken } from "@/lib/admin/token";
import { clearFailures, recordFailure, throttleStatus } from "@/lib/admin/throttle";
import { customerWhatsApp, defaultTemplateKey, templatesFor } from "@/lib/admin/whatsapp";
import { db, NotFoundError, SlugTakenError } from "@/lib/db";
import { memoryStore } from "@/lib/db/memory";
import type { Order, OrderItem, Product } from "@/lib/types";

const rules = { nameMaxLength: 12, nameUppercase: true };
const now = new Date("2026-11-01T10:00:00Z");

const item = (over: Partial<OrderItem> = {}): OrderItem => ({ slug: "flame", productName: "Flame Hoodie", colorway: "Midnight", size: "M", name: "ARYAN", qty: 1, unitPriceInr: 1000, ...over });
const order = (over: Partial<Order> = {}): Order => ({
  id: "00000000-0000-4000-8000-000000000001",
  code: "HD-AAAA",
  batch_id: "b1",
  user_id: "u1",
  email: "a@example.com",
  full_name: "Aryan Kumar",
  phone: "9876543210",
  hostel: "H4",
  room: "12",
  items: [item()],
  total_inr: 1000,
  utr: null,
  payment_status: "pending",
  order_status: "placed",
  refund_status: "none",
  admin_note: null,
  verified_at: null,
  freebie: false,
  created_at: "2026-10-30T08:00:00Z",
  ...over,
});
const product = (over: Partial<Product> = {}): Product => ({ id: "p1", slug: "flame", name: "Flame Hoodie", type: "hoodie", description: "", price_inr: 1000, compare_at_inr: null, colorways: [{ name: "Midnight", body: "#000000", stitch: "#ff0000" }], sizes: ["S", "M", "L"], personalizable: true, active: true, sort: 1, photos: [], ...over });
const plan = (o: Order, a: OrderAction, products = [product()]) => planOrderAction(o, a, { now, products, rules });
const paid = (over: Partial<Order> = {}) => order({ payment_status: "verified", verified_at: now.toISOString(), ...over });

// ---------- order flow

test("verify: marks paid with a timestamp, notes the UTR, and can't repeat", () => {
  const p = plan(order({ utr: "412345678901" }), { type: "verify" });
  assert.ok(p.ok);
  assert.deepEqual(p.patch, { payment_status: "verified", verified_at: now.toISOString() });
  assert.equal(p.event.type, "payment_verified");
  assert.equal(p.event.note, "UTR 412345678901");
  assert.equal(plan(paid(), { type: "verify" }).ok, false);
});

test("reject and reset clear the verified timestamp", () => {
  const r = plan(paid(), { type: "reject", reason: "amount mismatch" });
  assert.ok(r.ok);
  assert.deepEqual(r.patch, { payment_status: "rejected", verified_at: null });
  assert.equal(r.event.note, "amount mismatch");
  const reset = plan(paid(), { type: "reset_payment" });
  assert.ok(reset.ok);
  assert.deepEqual(reset.patch, { payment_status: "pending", verified_at: null });
  assert.equal(plan(order(), { type: "reset_payment" }).ok, false);
});

test("fulfilment needs a verified payment; cancelling and reopening do not", () => {
  for (const status of ["in_production", "ready", "collected"] as const) {
    assert.equal(plan(order(), { type: "status", status }).ok, false, `${status} while unpaid`);
    assert.equal(plan(order({ payment_status: "rejected" }), { type: "status", status }).ok, false);
    assert.ok(plan(paid(), { type: "status", status }).ok, `${status} when paid`);
  }
  assert.ok(plan(order(), { type: "status", status: "cancelled" }).ok);
  assert.ok(plan(order({ order_status: "cancelled" }), { type: "status", status: "placed" }).ok);
  assert.equal(plan(paid({ order_status: "ready" }), { type: "status", status: "ready" }).ok, false, "already there");
  assert.equal(plan(paid(), { type: "status", status: "ready" }).ok && "status_ready", "status_ready");
});

test("refunds need a verified payment and move through the states", () => {
  assert.equal(plan(order(), { type: "refund", refund: "requested" }).ok, false);
  const start = plan(paid(), { type: "refund", refund: "requested" });
  assert.ok(start.ok);
  assert.equal(start.event.type, "refund_requested");
  assert.ok(plan(paid({ refund_status: "requested" }), { type: "refund", refund: "approved" }).ok);
  assert.ok(plan(paid({ refund_status: "approved" }), { type: "refund", refund: "refunded" }).ok);
  assert.ok(plan(paid({ refund_status: "approved" }), { type: "refund", refund: "none" }).ok);
  assert.equal(plan(paid({ refund_status: "requested" }), { type: "refund", refund: "requested" }).ok, false);
  // a cancelled order that WAS verified can still be refunded even after its payment is reset
  assert.ok(plan(order({ verified_at: now.toISOString() }), { type: "refund", refund: "requested" }).ok);
});

test("editing an item: name rules, sizes from the product, a logged description, total untouched", () => {
  const o = paid({ items: [item(), item({ name: "SAM", size: "S" })] });
  const p = plan(o, { type: "edit_item", index: 0, name: "aryan k.", size: "l" });
  assert.ok(p.ok);
  const items = p.patch.items!;
  assert.equal(items[0].name, "ARYAN K.");
  assert.equal(items[0].size, "L");
  assert.deepEqual(items[1], o.items[1], "other items untouched");
  assert.equal("total_inr" in p.patch, false);
  assert.match(p.event.note ?? "", /name "ARYAN" → "ARYAN K\.".*size M → L/);

  assert.equal(plan(o, { type: "edit_item", index: 0, name: "Bobby;DROP" }).ok, false);
  assert.equal(plan(o, { type: "edit_item", index: 0, name: "A".repeat(13) }).ok, false);
  assert.equal(plan(o, { type: "edit_item", index: 0, size: "XXL" }).ok, false, "not made in that size");
  assert.equal(plan(o, { type: "edit_item", index: 0, size: "M" }).ok, false, "nothing changed");
  assert.equal(plan(o, { type: "edit_item", index: 5, name: "X" }).ok, false);
  assert.equal(plan(o, { type: "edit_item", index: 0, name: "X" }, [product({ personalizable: false })]).ok, false);
  assert.ok(plan(o, { type: "edit_item", index: 0, name: "" }).ok, "a name can be removed");
});

test("note: trimmed, capped, and an unchanged note is rejected", () => {
  const p = plan(order(), { type: "note", note: "  call before pickup  " });
  assert.ok(p.ok);
  assert.equal(p.patch.admin_note, "call before pickup");
  assert.equal(plan(order({ admin_note: "x" }), { type: "note", note: "x" }).ok, false);
  const cleared = plan(order({ admin_note: "x" }), { type: "note", note: "" });
  assert.ok(cleared.ok);
  assert.equal(cleared.message, "Note cleared");
});

// ---------- stats

test("stats count only paid, uncancelled, unrefunded orders as revenue and items", () => {
  const orders = [
    paid({ id: "1", total_inr: 2000, items: [item({ size: "M", qty: 2 })] }),
    paid({ id: "2", total_inr: 1000, items: [item({ size: "XL" })] }),
    paid({ id: "3", total_inr: 1000, items: [item({ size: "S" })], order_status: "cancelled" }),
    paid({ id: "4", total_inr: 1000, items: [item({ size: "L" })], refund_status: "approved" }),
    paid({ id: "5", total_inr: 1500, items: [item({ size: "L" })], refund_status: "refunded" }),
    paid({ id: "6", total_inr: 500, items: [item({ size: "S" })], refund_status: "requested" }),
    order({ id: "7", total_inr: 800 }),
    order({ id: "8", total_inr: 300, order_status: "cancelled" }),
    order({ id: "9", total_inr: 200, payment_status: "rejected" }),
  ];
  const s = computeStats(orders);
  assert.equal(s.orders, 9);
  assert.equal(s.verified, 6);
  assert.equal(s.pending, 1, "a cancelled unpaid order is not waiting on anyone");
  assert.equal(s.pendingAmount, 800);
  assert.equal(s.rejected, 1);
  assert.equal(s.cancelled, 2);
  assert.equal(s.verifiedRevenue, 2000 + 1000 + 500, "requested refunds still count until approved");
  assert.equal(s.refundsOpen, 2);
  assert.equal(s.refunded, 1);
  assert.equal(s.refundedAmount, 1500);
  assert.equal(s.items, 4);
  assert.deepEqual(s.itemsBySize, [{ size: "S", count: 1 }, { size: "M", count: 2 }, { size: "XL", count: 1 }], "sizes come in garment order, not alphabetical");
});

// ---------- vendor export

test("vendor rows: paid orders only, one row per item, and never any contact or payment data", () => {
  const orders = [
    paid({ code: "HD-BBBB", items: [item({ name: "SAM", size: "L", qty: 2 })], email: "secret@example.com", phone: "9123456789", utr: "UTR123456789" }),
    paid({ code: "HD-AAAA", items: [item(), item({ colorway: "Ash", size: "S", name: "" })] }),
    order({ code: "HD-CCCC" }),
    paid({ code: "HD-DDDD", order_status: "cancelled" }),
  ];
  const rows = vendorRows(orders);
  assert.deepEqual(rows.map((r) => r.orderCode), ["HD-AAAA", "HD-AAAA", "HD-BBBB"]);

  const csv = toCsv(rows);
  assert.ok(csv.startsWith("﻿product,colour,size,name,quantity,order_code\r\n"));
  for (const secret of ["secret@example.com", "9123456789", "UTR123456789", "Aryan Kumar", "a@example.com", "H4"]) assert.ok(!csv.includes(secret), `${secret} must not be in the vendor CSV`);
  assert.match(csv, /Flame Hoodie,Midnight,L,SAM,2,HD-BBBB/);
});

test("CSV is safe to open in a spreadsheet: formulas are neutralised, quotes and commas escaped", () => {
  const csv = toCsv([
    { product: "=cmd|' /c calc'!A0", colour: "+1", size: "M", name: "-ARYAN", quantity: 1, orderCode: "HD-AAAA" },
    { product: 'He said "hi", ok', colour: "@x", size: "M", name: "", quantity: 1, orderCode: "HD-BBBB" },
  ]);
  const lines = csv.split("\r\n");
  assert.ok(lines[1].startsWith(`'=cmd`), "leading = is defused");
  assert.ok(lines[1].includes(",'+1,"));
  assert.ok(lines[1].includes(",'-ARYAN,"));
  assert.ok(lines[2].startsWith('"He said ""hi"", ok"'));
  assert.ok(lines[2].includes(",'@x,"));
});

test("pivot: units by product × colour × size with totals", () => {
  const t = pivot(
    vendorRows([
      paid({ code: "HD-AAAA", items: [item({ size: "M", qty: 2 }), item({ colorway: "Ash", size: "S" })] }),
      paid({ code: "HD-BBBB", items: [item({ size: "M" }), item({ size: "XL", qty: 3 })] }),
    ]),
  );
  assert.deepEqual(t.sizes, ["S", "M", "XL"]);
  assert.equal(t.grandTotal, 7);
  assert.deepEqual(t.totals, { S: 1, M: 3, XL: 3 });
  const midnight = t.rows.find((r) => r.colour === "Midnight")!;
  assert.deepEqual(midnight.counts, { M: 3, XL: 3 });
  assert.equal(midnight.total, 6);
});

// ---------- whatsapp

test("WhatsApp templates carry the code, total and live settings; the default fits the state", () => {
  const s = { ...defaultSettings, upiId: "aryan@oksbi", pickupRoom: "Room 12", pickupHours: "6-9pm" };
  const t = templatesFor(order({ total_inr: 1999 }), s, { id: "b", name: "Batch 02", opens_at: "", closes_at: "", est_delivery: "25 Nov", status: "open" });
  const byKey = Object.fromEntries(t.map((x) => [x.key, x.text]));
  assert.match(byKey.payment_reminder, /HD-AAAA/);
  assert.match(byKey.payment_reminder, /₹1,999/);
  assert.match(byKey.payment_reminder, /aryan@oksbi/);
  assert.match(byKey.in_production, /25 Nov/);
  assert.match(byKey.ready, /Room 12.*6-9pm/);
  assert.match(byKey.collected, /5 days/);
  assert.ok(byKey.payment_reminder.startsWith("Hi Aryan,"));

  assert.equal(defaultTemplateKey(order()), "payment_reminder");
  assert.equal(defaultTemplateKey(order({ payment_status: "rejected" })), "payment_issue");
  assert.equal(defaultTemplateKey(paid()), "payment_verified");
  assert.equal(defaultTemplateKey(paid({ order_status: "in_production" })), "in_production");
  assert.equal(defaultTemplateKey(paid({ order_status: "ready" })), "ready");
  assert.equal(defaultTemplateKey(paid({ order_status: "collected" })), "collected");
  assert.equal(defaultTemplateKey(paid({ refund_status: "approved" })), "refund_approved");
  assert.equal(defaultTemplateKey(order({ order_status: "cancelled" })), "cancelled");

  assert.equal(customerWhatsApp("9876543210", "hi there"), "https://wa.me/919876543210?text=hi%20there");
});

// ---------- admin session

test("admin token: signed, verifiable, tamper-proof, and the login can only land inside /admin", async () => {
  const saved = { p: process.env.ADMIN_PASSWORD, s: process.env.ADMIN_SESSION_SECRET };
  process.env.ADMIN_PASSWORD = "hunter2";
  process.env.ADMIN_SESSION_SECRET = "x".repeat(40);
  try {
    assert.equal(adminConfig().ready, true);
    const token = (await signAdminToken())!;
    assert.equal(await verifyAdminToken(token), true);
    assert.equal(await verifyAdminToken(token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa")), false, "tampered signature");
    assert.equal(await verifyAdminToken("not.a.jwt"), false);
    assert.equal(await verifyAdminToken(undefined), false);

    process.env.ADMIN_SESSION_SECRET = "y".repeat(40); // rotating the secret logs everyone out
    assert.equal(await verifyAdminToken(token), false);
  } finally {
    process.env.ADMIN_PASSWORD = saved.p;
    process.env.ADMIN_SESSION_SECRET = saved.s;
    if (saved.p === undefined) delete process.env.ADMIN_PASSWORD;
    if (saved.s === undefined) delete process.env.ADMIN_SESSION_SECRET;
  }
  assert.equal(safeAdminNext("/admin/orders?order=HD-AAAA"), "/admin/orders?order=HD-AAAA");
  for (const bad of ["https://evil.com", "//evil.com", "/orders", "/admin/login", "/admin//x", "", null, undefined]) assert.equal(safeAdminNext(bad), "/admin", String(bad));
});

test("login throttle blocks after 5 misses and recovers after the window", () => {
  const ip = `test-${Math.random()}`;
  const t0 = 1_000_000;
  for (let i = 0; i < 4; i++) recordFailure(ip, t0 + i);
  assert.equal(throttleStatus(ip, t0 + 10).blocked, false);
  recordFailure(ip, t0 + 5);
  const gate = throttleStatus(ip, t0 + 6);
  assert.equal(gate.blocked, true);
  assert.ok(gate.retryInMinutes >= 1 && gate.retryInMinutes <= 10);
  assert.equal(throttleStatus(ip, t0 + 11 * 60_000).blocked, false, "window passed");
  clearFailures(ip);
  assert.equal(throttleStatus(ip, t0 + 6).blocked, false);
});

test("IST date inputs round-trip regardless of the server timezone", () => {
  const iso = fromIstInput("2026-11-10T21:30")!;
  assert.equal(iso, "2026-11-10T16:00:00.000Z");
  assert.equal(toIstInput(iso), "2026-11-10T21:30");
  assert.equal(fromIstInput("garbage"), null);
});

// ---------- admin DB operations (demo store)

beforeEach(async () => {
  await db().listActiveProducts();
  const s = memoryStore();
  s.orders.length = 0;
  s.events.length = 0;
});

test("products: create, slug uniqueness, update, hide from the shop, delete", async () => {
  const d = db();
  const input = { slug: "test-tee", name: "Test Tee", type: "tee" as const, description: "", price_inr: 499, compare_at_inr: null, colorways: [{ name: "Bone", body: "#e4dfd3", stitch: "#111111" }], sizes: ["M", "L"], personalizable: true, active: true, sort: 9 };
  const created = await d.createProduct(input);
  await assert.rejects(d.createProduct(input), SlugTakenError);
  assert.ok((await d.listActiveProducts()).some((p) => p.slug === "test-tee"));

  await d.updateProduct(created.id, { ...input, price_inr: 599, active: false });
  assert.equal((await d.getProductById(created.id))?.price_inr, 599);
  assert.ok(!(await d.listActiveProducts()).some((p) => p.slug === "test-tee"), "inactive products leave the shop");
  assert.ok((await d.listAllProducts()).some((p) => p.slug === "test-tee"), "but stay in admin");
  await assert.rejects(d.updateProduct(created.id, { ...input, slug: "iit-bombay-hoodie" }), SlugTakenError);
  await assert.rejects(d.updateProduct("00000000-0000-4000-8000-0000000000ff", input), NotFoundError);

  await d.deleteProduct(created.id);
  assert.equal(await d.getProductById(created.id), null);
});

test("batches: create, update, and the open batch is the newest open one", async () => {
  const d = db();
  const b = await d.createBatch({ name: "Batch 99", opens_at: "2030-01-01T00:00:00Z", closes_at: "2030-01-15T00:00:00Z", est_delivery: "Feb", status: "open" });
  assert.equal((await d.getOpenBatch())?.id, b.id);
  await d.updateBatch(b.id, { status: "closed" });
  assert.notEqual((await d.getOpenBatch())?.id, b.id);
  assert.equal((await d.getBatch(b.id))?.status, "closed");
  await assert.rejects(d.updateBatch("00000000-0000-4000-8000-0000000000fe", { name: "x" }), NotFoundError);
});

test("orders: search by code/email/name/phone, filter, sort, paginate; patch writes an audit row", async () => {
  const d = db();
  const batch = (await d.getOpenBatch())!;
  const mk = async (code: string, name: string, phone: string, email: string) => d.insertOrder({ code, batch_id: batch.id, user_id: "u1", email, full_name: name, phone, hostel: "H4", room: "1", items: [item()], total_inr: 1000 });
  const a = await mk("HD-AAAA", "Aryan Kumar", "9876543210", "aryan@example.com");
  await new Promise((r) => setTimeout(r, 5));
  const b = await mk("HD-BBBB", "Sam Lee", "9123456780", "sam@example.com");
  const base = { limit: 25, offset: 0 };

  assert.equal((await d.searchOrders({ ...base, q: "aryan" })).total, 1);
  assert.equal((await d.searchOrders({ ...base, q: "HD-BBBB" })).rows[0].id, b.id);
  assert.equal((await d.searchOrders({ ...base, q: "91234" })).rows[0].id, b.id);
  assert.equal((await d.searchOrders({ ...base, q: "SAM@EXAMPLE" })).total, 1, "case-insensitive");
  assert.deepEqual((await d.searchOrders({ ...base })).rows.map((o) => o.code), ["HD-BBBB", "HD-AAAA"], "newest first");
  assert.deepEqual((await d.searchOrders({ ...base, sort: "old" })).rows.map((o) => o.code), ["HD-AAAA", "HD-BBBB"]);
  const page2 = await d.searchOrders({ limit: 1, offset: 1 });
  assert.equal(page2.total, 2);
  assert.equal(page2.rows.length, 1);

  const verified = await d.patchOrder(a.id, { payment_status: "verified", verified_at: now.toISOString() }, { type: "payment_verified", note: "ok" });
  assert.equal(verified.payment_status, "verified");
  assert.equal((await d.searchOrders({ ...base, payment: "verified" })).total, 1);
  assert.equal((await d.searchOrders({ ...base, payment: "pending" })).rows[0].code, "HD-BBBB");
  await d.patchOrder(a.id, { refund_status: "requested" }, { type: "refund_requested" });
  assert.equal((await d.searchOrders({ ...base, refund: "open" })).total, 1);
  assert.equal((await d.searchOrders({ ...base, batchId: "nope" })).total, 0);

  const events = await d.listEvents(a.id);
  assert.deepEqual(events.map((e) => e.type), ["refund_requested", "payment_verified"], "newest first");
  await assert.rejects(d.patchOrder("00000000-0000-4000-8000-0000000000fd", {}, { type: "x" }), NotFoundError);
});

test("customers: search by name, email, roll number and phone", async () => {
  const d = db();
  const tag = `${Date.now()}`;
  await d.createProfile(crypto.randomUUID(), `cust${tag}@example.com`, { full_name: `Priya ${tag}`, phone: "9000011111", roll_no: `22B${tag}`, default_size: null });
  assert.equal((await d.listProfiles(`priya ${tag}`)).length, 1);
  assert.equal((await d.listProfiles(`cust${tag}@`)).length, 1);
  assert.equal((await d.listProfiles(`22b${tag}`)).length, 1);
  assert.equal((await d.listProfiles("9000011111")).length >= 1, true);
  assert.equal((await d.listProfiles(`nobody-${tag}`)).length, 0);
});

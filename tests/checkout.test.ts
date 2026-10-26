import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { placeOrder } from "@/actions/checkout";
import { lookupOrders, submitUtr } from "@/actions/orders";
import { site } from "@/config/site";
import { db } from "@/lib/db";

type Store = { batch: { closes_at: string; opens_at: string; status: string }; orders: { code: string; email: string; utr: string | null; payment_status: string; total_inr: number }[] };
const store = () => (globalThis as unknown as { __merchMemoryStore: Store }).__merchMemoryStore;

const form = (over: Record<string, string> = {}) => {
  const f = new FormData();
  const base: Record<string, string> = {
    fullName: "Aryan Kumar",
    email: "aryan@example.com",
    phone: "98765 43210",
    hostel: "Hostel 4",
    room: "112",
    confirmSpelling: "on",
    confirmPolicy: "on",
    items: JSON.stringify([{ slug: "midnight-flame", colorway: "Midnight", size: "M", name: "aryan", qty: 2 }]),
    ...over,
  };
  for (const [k, v] of Object.entries(base)) if (v !== "__omit__") f.set(k, v);
  return f;
};

beforeEach(async () => {
  await db().listActiveProducts(); // makes sure the demo store exists
  store().orders.length = 0;
  store().batch.status = "open";
  store().batch.opens_at = new Date(Date.now() - 1000).toISOString();
  store().batch.closes_at = new Date(Date.now() + 86_400_000).toISOString();
});

test("places an order, re-priced from the DB, with a valid code", async () => {
  const r = await placeOrder({ ok: false }, form());
  assert.equal(r.ok, true, r.message);
  const order = store().orders[0];
  assert.equal(order.code, r.code);
  assert.equal(order.total_inr, 999 * 2);
  assert.equal(order.payment_status, "pending");
});

test("honeypot submissions create nothing", async () => {
  const r = await placeOrder({ ok: false }, form({ fax: "bot" }));
  assert.equal(r.ok, false);
  assert.equal(store().orders.length, 0);
});

test("returns inline field errors and keeps what the user typed", async () => {
  const r = await placeOrder({ ok: false }, form({ phone: "123", email: "nope", confirmPolicy: "__omit__" }));
  assert.equal(r.ok, false);
  assert.ok(r.fieldErrors?.phone && r.fieldErrors.email && r.fieldErrors.confirmPolicy);
  assert.equal(r.values?.email, "nope");
  assert.equal(store().orders.length, 0);
});

test("refuses once the batch cutoff has passed, or the batch is closed", async () => {
  store().batch.closes_at = new Date(Date.now() - 1000).toISOString();
  assert.equal((await placeOrder({ ok: false }, form())).ok, false);
  store().batch.closes_at = new Date(Date.now() + 86_400_000).toISOString();
  store().batch.status = "closed";
  assert.equal((await placeOrder({ ok: false }, form())).ok, false);
  assert.equal(store().orders.length, 0);
});

test("enforces the pending-order limit per email (case-insensitive)", async () => {
  for (let i = 0; i < site.maxPendingOrdersPerEmail; i++) assert.equal((await placeOrder({ ok: false }, form())).ok, true);
  const blocked = await placeOrder({ ok: false }, form({ email: "ARYAN@example.com" }));
  assert.equal(blocked.ok, false);
  assert.match(blocked.message ?? "", /unpaid/);
  assert.equal((await placeOrder({ ok: false }, form({ email: "other@example.com" }))).ok, true);
});

test("rejects an unknown product or tampered line", async () => {
  const items = JSON.stringify([{ slug: "ghost", colorway: "x", size: "M", name: "", qty: 1 }]);
  assert.equal((await placeOrder({ ok: false }, form({ items }))).ok, false);
  assert.equal((await placeOrder({ ok: false }, form({ items: "{not json" }))).ok, false);
  assert.equal(store().orders.length, 0);
});

test("UTR can be saved only while payment is pending", async () => {
  const { code } = await placeOrder({ ok: false }, form());
  const f = new FormData();
  f.set("code", code!);
  f.set("utr", "412345678901");
  assert.equal((await submitUtr({ ok: false }, f)).ok, true);
  assert.equal(store().orders[0].utr, "412345678901");

  store().orders[0].payment_status = "verified";
  f.set("utr", "999999999999");
  assert.equal((await submitUtr({ ok: false }, f)).ok, false);
  assert.equal(store().orders[0].utr, "412345678901", "a settled order is never rewritten");
});

test("track needs an email that matches the order code, and hides private fields", async () => {
  const { code } = await placeOrder({ ok: false }, form());
  const lookup = (email: string, c: string) => {
    const f = new FormData();
    f.set("email", email);
    f.set("code", c);
    return lookupOrders({ ok: false }, f);
  };
  assert.equal((await lookup("stranger@example.com", code!)).ok, false);
  assert.equal((await lookup("aryan@example.com", "HD-AAAA")).ok, false);
  const hit = await lookup("Aryan@Example.com", code!.toLowerCase());
  assert.equal(hit.ok, true);
  assert.equal(hit.orders?.length, 1);
  const keys = Object.keys(hit.orders![0]);
  for (const secret of ["phone", "email", "utr", "admin_note", "room", "hostel", "full_name"]) assert.ok(!keys.includes(secret), `${secret} must not leak`);
});

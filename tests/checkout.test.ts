import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { placeOrder } from "@/actions/checkout";
import { defaultSettings } from "@/config/site";
import { db } from "@/lib/db";
import { memoryStore } from "@/lib/db/memory";
import { placeOrderFor, type PlaceOrderInput } from "@/lib/orders/place-order";
import { saveUtrFor } from "@/lib/orders/save-utr";

const user = { id: "00000000-0000-4000-8000-0000000000a1", email: "aryan@example.com", name: "Aryan" };
const other = { id: "00000000-0000-4000-8000-0000000000a2", email: "other@example.com", name: "Other" };

const input = (over: Omit<Partial<PlaceOrderInput>, "values"> & { values?: Partial<PlaceOrderInput["values"]> } = {}): PlaceOrderInput => ({
  values: { fullName: "Aryan Kumar", phone: "98765 43210", hostel: "Hostel 4", room: "112", ...over.values },
  items: over.items ?? [{ slug: "iit-bombay-hoodie", colorway: "Black", size: "M", name: "aryan", qty: 2 }],
  confirmSpelling: over.confirmSpelling ?? true,
  confirmPolicy: over.confirmPolicy ?? true,
});

const s = () => memoryStore();

beforeEach(async () => {
  await db().listActiveProducts(); // makes sure the demo store exists
  s().orders.length = 0;
  s().events.length = 0;
  s().settings = null;
  const b = s().batches[0];
  b.status = "open";
  b.opens_at = new Date(Date.now() - 1000).toISOString();
  b.closes_at = new Date(Date.now() + 86_400_000).toISOString();
});

test("places an order for the logged-in user, re-priced from the DB, with a valid code", async () => {
  const r = await placeOrderFor(user, input());
  assert.equal(r.ok, true, r.message);
  const order = s().orders[0];
  assert.equal(order.code, r.code);
  assert.equal(order.total_inr, (799 + 99) * 2 - 180, "₹99 name print, then 10% off above ₹1499");
  assert.equal(order.discount_inr, 180);
  assert.equal(order.payment_status, "pending");
  assert.equal(order.user_id, user.id);
  assert.equal(order.email, user.email, "email comes from the account, not the form");
  assert.equal(order.items[0].name, "ARYAN");
  assert.equal(s().events.at(-1)?.type, "placed");
});

test("a form-supplied email or user id is ignored", async () => {
  const forged = { ...input(), email: "victim@example.com", user_id: other.id } as PlaceOrderInput;
  assert.equal((await placeOrderFor(user, forged)).ok, true);
  assert.equal(s().orders[0].email, user.email);
  assert.equal(s().orders[0].user_id, user.id);
});

test("honeypot submissions create nothing", async () => {
  const f = new FormData();
  f.set("fax", "bot");
  f.set("items", "[]");
  const r = await placeOrder({ ok: false }, f);
  assert.equal(r.ok, false);
  assert.equal(s().orders.length, 0);
});

test("returns inline field errors and keeps what the user typed", async () => {
  const r = await placeOrderFor(user, input({ values: { phone: "123" }, confirmPolicy: false }));
  assert.equal(r.ok, false);
  assert.ok(r.fieldErrors?.phone && r.fieldErrors.confirmPolicy);
  assert.equal(r.values?.phone, "123");
  assert.equal(s().orders.length, 0);
});

test("refuses once the batch cutoff has passed, or the batch is closed", async () => {
  s().batches[0].closes_at = new Date(Date.now() - 1000).toISOString();
  assert.equal((await placeOrderFor(user, input())).ok, false);
  s().batches[0].closes_at = new Date(Date.now() + 86_400_000).toISOString();
  s().batches[0].status = "closed";
  assert.equal((await placeOrderFor(user, input())).ok, false);
  assert.equal(s().orders.length, 0);
});

test("enforces the pending-order limit per account, as set in settings", async () => {
  for (let i = 0; i < defaultSettings.maxPendingOrdersPerEmail; i++) assert.equal((await placeOrderFor(user, input())).ok, true);
  const blocked = await placeOrderFor(user, input());
  assert.equal(blocked.ok, false);
  assert.match(blocked.message ?? "", /unpaid/);
  assert.equal((await placeOrderFor(other, input())).ok, true, "another account is unaffected");

  // The limit is a runtime setting: raising it takes effect immediately.
  s().settings = { ...defaultSettings, maxPendingOrdersPerEmail: 5 };
  assert.equal((await placeOrderFor(user, input())).ok, true);
});

test("name rules come from runtime settings", async () => {
  const long = [{ slug: "iit-bombay-hoodie", colorway: "Black", size: "M", name: "Aryan Kumar Singh", qty: 1 }];
  assert.equal((await placeOrderFor(user, input({ items: long }))).ok, false, "17 chars exceeds the default 12");
  s().settings = { ...defaultSettings, nameMaxLength: 20, nameUppercase: false };
  const ok = await placeOrderFor(user, input({ items: long }));
  assert.equal(ok.ok, true, ok.message);
  assert.equal(s().orders[0].items[0].name, "Aryan Kumar Singh");
});

test("rejects an unknown product or tampered line", async () => {
  assert.equal((await placeOrderFor(user, input({ items: [{ slug: "ghost", colorway: "x", size: "M", name: "", qty: 1 }] }))).ok, false);
  assert.equal((await placeOrderFor(user, input({ items: [] }))).ok, false);
  assert.equal(s().orders.length, 0);
});

test("UTR can be saved only by the owner, and only while payment is pending", async () => {
  const { code } = await placeOrderFor(user, input());
  assert.equal((await saveUtrFor(other, code!, "412345678901")).ok, false, "someone else's order");
  assert.equal(s().orders[0].utr, null);

  assert.equal((await saveUtrFor(user, code!, "412345678901")).ok, true);
  assert.equal(s().orders[0].utr, "412345678901");

  s().orders[0].payment_status = "verified";
  assert.equal((await saveUtrFor(user, code!, "999999999999")).ok, false);
  assert.equal(s().orders[0].utr, "412345678901", "a settled order is never rewritten");
});

test("orders are listed per account", async () => {
  await placeOrderFor(user, input());
  await placeOrderFor(other, input());
  assert.equal((await db().listOrdersByUser(user.id)).length, 1);
  assert.equal((await db().listOrdersByUser(other.id)).length, 1);
});

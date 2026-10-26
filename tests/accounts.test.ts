import assert from "node:assert/strict";
import { test } from "node:test";
import { demoBackend } from "@/lib/auth/demo";
import { db, EmailTakenError } from "@/lib/db";

// Cookie-based session handling needs a request, so these cover the account store itself.
test("demo accounts: create, duplicate, password check and change", async () => {
  const email = `t${Date.now()}@example.com`;
  const created = await demoBackend.createUser(email, "correct-horse", { fullName: "Test User" });
  assert.ok("id" in created);
  assert.deepEqual(await demoBackend.createUser(email, "another-pass", { fullName: "Dup" }), { error: "exists" });

  assert.equal(await demoBackend.checkPassword(email, "correct-horse"), true);
  assert.equal(await demoBackend.checkPassword(email, "wrong"), false);
  assert.equal(await demoBackend.checkPassword("nobody@example.com", "correct-horse"), false);

  await demoBackend.setPassword(created.id, "brand-new-pass");
  assert.equal(await demoBackend.checkPassword(email, "correct-horse"), false, "the old password stops working");
  assert.equal(await demoBackend.checkPassword(email, "brand-new-pass"), true);

  await demoBackend.deleteUser(created.id);
  assert.equal(await demoBackend.checkPassword(email, "brand-new-pass"), false);
});

test("profiles: create, update, one profile per email", async () => {
  const d = db();
  const id = crypto.randomUUID();
  const email = `p${Date.now()}@example.com`;
  const p = await d.createProfile(id, email, { full_name: "Aryan K", phone: "9876543210", roll_no: null, default_size: "M" });
  assert.equal(p.email, email);
  assert.equal((await d.getProfile(id))?.default_size, "M");

  const updated = await d.updateProfile(id, { full_name: "Aryan Kumar", phone: "9876543210", roll_no: "22B1234", default_size: null });
  assert.equal(updated.roll_no, "22B1234");
  assert.equal(updated.default_size, null);

  await assert.rejects(d.createProfile(crypto.randomUUID(), email, { full_name: "Dup", phone: "9876543210", roll_no: null, default_size: null }), EmailTakenError);
  assert.equal(await d.getProfile(crypto.randomUUID()), null);
});

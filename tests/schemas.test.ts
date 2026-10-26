import assert from "node:assert/strict";
import { test } from "node:test";
import { checkoutSchema, normalizeOrderCode, orderCodeSchema, personalName, phoneSchema, utrSchema } from "@/lib/schemas";

test("personal name: letters, spaces and .'- only, max 12, uppercased", () => {
  assert.equal(personalName.parse("o'neil-k."), "O'NEIL-K.");
  assert.equal(personalName.parse(""), "");
  assert.equal(personalName.safeParse("A".repeat(13)).success, false);
  for (const bad of ["Sam1", "Sam_", "<b>", "Sam😀", "Sam,Lee"]) assert.equal(personalName.safeParse(bad).success, false, bad);
});

test("phone accepts common Indian formats and normalises to 10 digits", () => {
  for (const ok of ["9876543210", "98765 43210", "+91 98765 43210", "919876543210", "09876543210", "98765-43210"]) {
    assert.equal(phoneSchema.parse(ok), "9876543210", ok);
  }
  for (const bad of ["5876543210", "987654321", "98765432101", "abcdefghij", ""]) assert.equal(phoneSchema.safeParse(bad).success, false, bad);
});

test("order codes normalise typing variants and reject ambiguous characters", () => {
  assert.equal(normalizeOrderCode("hd 7k4q"), "HD-7K4Q");
  assert.equal(orderCodeSchema.parse("hd7k4q"), "HD-7K4Q");
  for (const bad of ["HD-0K4Q", "HD-OK4Q", "HD-1K4Q", "HD-IK4Q", "HD-LK4Q", "HD-7K4", "XX-7K4Q"]) assert.equal(orderCodeSchema.safeParse(bad).success, false, bad);
});

test("UTR must be 8-22 alphanumerics", () => {
  assert.equal(utrSchema.safeParse("412345678901").success, true);
  assert.equal(utrSchema.safeParse("1234").success, false);
  assert.equal(utrSchema.safeParse("1234 5678 9012").success, false);
});

test("checkout requires both confirmations and a non-empty cart", () => {
  const base = { fullName: "Aryan Kumar", email: "A@B.com", phone: "9876543210", hostel: "H4", room: "1", confirmSpelling: true, confirmPolicy: true, items: [{ slug: "x", colorway: "c", size: "M", name: "", qty: 1 }] };
  const ok = checkoutSchema.parse(base);
  assert.equal(ok.email, "a@b.com");
  assert.equal(checkoutSchema.safeParse({ ...base, confirmSpelling: false }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...base, confirmPolicy: false }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...base, items: [] }).success, false);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultSettings } from "@/config/site";
import { safeNext } from "@/lib/auth/next";
import { changePasswordSchema, logInSchema, makeCheckoutSchema, makeNameSchema, normalizeOrderCode, orderCodeSchema, phoneSchema, profileSchema, signUpSchema, utrSchema } from "@/lib/schemas";
import { mergeSettings, setupChecklist, settingsSchema } from "@/lib/settings-schema";

const rules = { nameMaxLength: 12, nameUppercase: true };

test("personal name: letters, spaces and .'- only, max length, capitals per settings", () => {
  const name = makeNameSchema(rules);
  assert.equal(name.parse("o'neil-k."), "O'NEIL-K.");
  assert.equal(name.parse(""), "");
  assert.equal(name.safeParse("A".repeat(13)).success, false);
  for (const bad of ["Sam1", "Sam_", "<b>", "Sam😀", "Sam,Lee"]) assert.equal(name.safeParse(bad).success, false, bad);
  assert.equal(makeNameSchema({ nameMaxLength: 20, nameUppercase: false }).parse("Aryan Kumar"), "Aryan Kumar");
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

test("checkout requires both confirmations and a non-empty cart; email is not a form field", () => {
  const schema = makeCheckoutSchema(rules);
  const base = { fullName: "Aryan Kumar", phone: "9876543210", hostel: "H4", room: "1", confirmSpelling: true, confirmPolicy: true, items: [{ slug: "x", colorway: "c", size: "M", name: "", qty: 1 }] };
  assert.ok(schema.parse(base));
  assert.equal(schema.safeParse({ ...base, confirmSpelling: false }).success, false);
  assert.equal(schema.safeParse({ ...base, confirmPolicy: false }).success, false);
  assert.equal(schema.safeParse({ ...base, items: [] }).success, false);
  assert.equal("email" in schema.shape, false);
});

test("sign-up: password min 8, phone required, optional fields become null, email lowercased", () => {
  const ok = signUpSchema.parse({ fullName: "Aryan Kumar", email: " A@B.com ", password: "longenough", phone: "98765 43210", rollNo: "", defaultSize: "xl" });
  assert.equal(ok.email, "a@b.com");
  assert.equal(ok.rollNo, null);
  assert.equal(ok.defaultSize, "XL");
  assert.equal(signUpSchema.safeParse({ fullName: "Aryan", email: "a@b.com", password: "short", phone: "9876543210" }).success, false);
  assert.equal(signUpSchema.safeParse({ fullName: "Aryan", email: "a@b.com", password: "longenough", phone: "" }).success, false);
  assert.equal(profileSchema.safeParse({ fullName: "A", phone: "9876543210" }).success, false, "name needs 2+ characters");
  assert.equal(logInSchema.safeParse({ email: "a@b.com", password: "" }).success, false);
  assert.equal(changePasswordSchema.safeParse({ current: "x", next: "1234567" }).success, false);
});

test("post-login redirects stay on this site", () => {
  assert.equal(safeNext("/checkout"), "/checkout");
  assert.equal(safeNext("/order/HD-7K4Q/pay?x=1"), "/order/HD-7K4Q/pay?x=1");
  for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "", null, undefined]) assert.equal(safeNext(bad), "/", String(bad));
});

test("settings: defaults are valid, bad stored values fall back per field", () => {
  assert.ok(settingsSchema.safeParse(defaultSettings).success);
  const merged = mergeSettings({ upiId: "aryan@oksbi", refundWindowDays: "five", phone: "not digits", nameMaxLength: 16, extra: "ignored" });
  assert.equal(merged.upiId, "aryan@oksbi");
  assert.equal(merged.refundWindowDays, defaultSettings.refundWindowDays);
  assert.equal(merged.phone, defaultSettings.phone);
  assert.equal(merged.nameMaxLength, 16);
  assert.equal("extra" in merged, false);
  assert.deepEqual(mergeSettings(null), defaultSettings);
});

test("setup checklist flags placeholders until real values are saved", () => {
  const todo = setupChecklist(defaultSettings).filter((i) => !i.done).map((i) => i.key);
  assert.deepEqual(todo, ["upi", "payee", "phone", "pickup", "tee-sizes"], "the hoodie chart ships filled in");
  const done = setupChecklist(
    mergeSettings({ upiId: "aryan@oksbi", payeeName: "Aryan K", phone: "919876543210", whatsapp: "919876543210", pickupRoom: "Room 12", pickupHours: "6-9pm", sizeCharts: { hoodie: { unit: "cm", columns: ["Chest"], rows: { M: ["54"] } }, tee: { unit: "cm", columns: ["Chest"], rows: { M: ["50"] } } } }),
  );
  assert.ok(done.every((i) => i.done), JSON.stringify(done.filter((i) => !i.done)));
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultSettings, site } from "@/config/site";
import { generateOrderCode } from "@/lib/order-code";
import { orderCodeSchema } from "@/lib/schemas";
import { upiLink, upiQrDataUrl } from "@/lib/upi";

const settings = { ...defaultSettings, upiId: "aryan@oksbi", payeeName: "Aryan Kumar" };

test("generated order codes are valid and never contain 0/O/1/I/L", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    const code = generateOrderCode();
    assert.ok(code.startsWith(`${site.orderCodePrefix}-`));
    assert.equal(orderCodeSchema.safeParse(code).success, true, code);
    assert.doesNotMatch(code.slice(site.orderCodePrefix.length + 1), /[01OIL]/);
    seen.add(code);
  }
  assert.ok(seen.size > 1900, "codes should be well spread");
});

test("UPI link carries the exact amount, INR and the order code, using the runtime UPI ID", () => {
  const link = upiLink(settings, 1999, "HD-7K4Q");
  assert.match(link, /^upi:\/\/pay\?pa=aryan@oksbi&/, "payee address stays unescaped");
  assert.ok(link.includes("am=1999.00"));
  assert.ok(link.includes("cu=INR"));
  assert.ok(link.includes("tn=HD-7K4Q"));
  assert.ok(link.includes("pn=Aryan%20Kumar"));
});

test("QR is a self-contained SVG data URL", async () => {
  const url = await upiQrDataUrl(upiLink(settings, 999, "HD-7K4Q"));
  assert.match(url, /^data:image\/svg\+xml;base64,/);
  assert.match(Buffer.from(url.split(",")[1], "base64").toString(), /<svg/);
});

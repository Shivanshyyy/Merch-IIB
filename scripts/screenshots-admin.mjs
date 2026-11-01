// Drives the whole admin panel (and the customer side it affects) in a real browser, asserting as it goes, and
// takes screenshots at desktop and phone size.
//   npm run with-server -- node scripts/screenshots-admin.mjs --out=<dir>
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = arg("out", "scripts/.out/shots-admin");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const problems = [];
const stamp = Date.now();

const watch = (page, label) => {
  page.on("pageerror", (e) => problems.push(`[${label}] pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/404|401/.test(m.text()) && problems.push(`[${label}] console: ${m.text()}`));
};

// ---- customer helpers ----
async function placeOrder(ctx, { name, product, size, nameOnBack, qty = 1, tag }) {
  const page = await ctx.newPage();
  watch(page, `customer ${tag}`);
  const email = `cust.${tag}.${stamp}@example.com`;
  const password = "correct horse battery";
  await page.goto(`${BASE}/shop/${product}`);
  await page.locator("label.chip", { hasText: new RegExp(`^${size}$`) }).click();
  await page.getByLabel(/Name on the back/i).fill(nameOnBack);
  for (let i = 1; i < qty; i++) await page.getByRole("button", { name: "Increase quantity" }).click();
  await page.getByRole("button", { name: /Add to cart/i }).click();
  await page.goto(`${BASE}/checkout`);
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Phone").fill("98765 4" + String(stamp).slice(-4));
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/checkout$/);
  await page.getByLabel("Hostel").fill("Hostel 4");
  await page.getByLabel("Room").fill("112");
  await page.locator("label", { hasText: "I confirmed the name spelling" }).click({ position: { x: 12, y: 12 } });
  await page.locator("label", { hasText: /read the/ }).click({ position: { x: 12, y: 12 } });
  await page.getByRole("button", { name: /Place order/i }).click();
  await page.waitForURL(/\/order\/HD-[A-Z0-9]{4}\/pay/, { timeout: 15000 });
  return { page, code: page.url().match(/HD-[A-Z0-9]{4}/)[0], email, password };
}

// ---- admin helpers ----
const shot = async (page, label, name, opts = {}) => {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${label}-${name}.png`, ...opts });
};
const toast = (page, text) => page.locator('[role="status"]').filter({ hasText: text }).first();
const overflow = async (page, label, name) => {
  const w = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (w > 0) problems.push(`[${label}] horizontal overflow ${w}px on ${name}`);
};

async function adminLogin(page, label) {
  await page.goto(`${BASE}/admin`);
  await page.waitForURL(/\/admin\/login/);
  await shot(page, label, "01-login");
  await page.getByLabel("Admin password").fill("definitely wrong");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByText("That isn't the admin password.").waitFor();
  await page.getByLabel("Admin password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(`${BASE}/admin`);
}

try {
  // ===================== customers place orders =====================
  const custCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const A = await placeOrder(custCtx, { name: "Aryan Kumar", product: "iit-bombay-hoodie", size: "M", nameOnBack: "aryan", tag: "a" });
  const custCtxB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const B = await placeOrder(custCtxB, { name: "Sam Lee", product: "iit-bombay-hoodie", size: "L", nameOnBack: "sam", qty: 2, tag: "b" });
  const custCtxC = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const C = await placeOrder(custCtxC, { name: "Priya Nair", product: "iit-bombay-hoodie", size: "S", nameOnBack: "priya", tag: "c" });
  await A.page.getByLabel(/UTR/i).fill("412345678901");
  await A.page.getByRole("button", { name: "Save UTR" }).click();
  await A.page.getByText(/Got it/).waitFor();
  console.log(`orders: A ${A.code}, B ${B.code}, C ${C.code}`);

  // ===================== desktop admin =====================
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const admin = await adminCtx.newPage();
  watch(admin, "admin desktop");
  const L = "desktop";

  // logged out: every admin URL redirects; the CSV endpoint refuses
  const anon = await (await browser.newContext()).newPage();
  assert.equal((await anon.request.get(`${BASE}/admin/export?batch=x`, { maxRedirects: 0 })).status() >= 300, true, "export must not serve a logged-out visitor");
  await anon.context().close();

  await adminLogin(admin, L);
  await admin.getByRole("heading", { name: "Dashboard" }).waitFor();
  await shot(admin, L, "02-dashboard-before");
  assert.match(await admin.getByText("Pending verifications").locator("..").innerText(), /3/, "three orders wait for verification");
  assert.match(await admin.locator("nav[aria-label=Admin]").innerText(), /Orders\s*3/, "nav badge shows the pending count");
  await overflow(admin, L, "dashboard");

  // ---- orders: filter + drawer ----
  await admin.locator("nav[aria-label=Admin]").getByRole("link", { name: /^Orders/ }).click();
  await admin.getByRole("heading", { name: "Orders" }).waitFor();
  await shot(admin, L, "03-orders");
  await admin.getByPlaceholder(/Search code/).fill("aryan");
  await admin.getByPlaceholder(/Search code/).press("Enter");
  await admin.waitForURL(/q=aryan/);
  assert.equal(await admin.locator("tbody tr").count(), 1, "search narrows to Aryan");
  await admin.getByPlaceholder(/Search code/).fill("");
  await admin.getByRole("link", { name: "Clear filters" }).click();
  await admin.locator("tbody tr").filter({ hasText: A.code }).click();
  const drawer = admin.getByRole("dialog", { name: `Order ${A.code}` });
  await drawer.waitFor();
  assert.match(await drawer.innerText(), /412345678901/, "the customer's UTR is shown");
  await shot(admin, L, "04-drawer");

  // unpaid orders cannot be fulfilled
  assert.equal(await drawer.getByRole("button", { name: "Move to production" }).isDisabled(), true);
  await drawer.getByRole("button", { name: "Verify payment" }).click();
  await toast(admin, "Payment verified").waitFor();
  await drawer.getByRole("button", { name: "Move to production" }).waitFor();
  assert.equal(await drawer.getByRole("button", { name: "Move to production" }).isDisabled(), false);

  // edit the name + size (logged), save a note, check the WhatsApp message
  await drawer.getByRole("button", { name: "Edit item 1" }).click();
  await drawer.getByLabel("Name on the back").fill("aryan k.");
  await drawer.getByLabel("Size").selectOption("L");
  await drawer.getByRole("button", { name: "Save item" }).click();
  await toast(admin, "Item updated").waitFor();
  await drawer.getByText("ARYAN K.").first().waitFor();
  await drawer.getByLabel("Note for this order").fill("Collect on Friday");
  await drawer.getByRole("button", { name: "Save note" }).click();
  await toast(admin, "Note saved").waitFor();
  const wa = await drawer.getByRole("link", { name: "Open in WhatsApp" }).getAttribute("href");
  assert.match(wa, /^https:\/\/wa\.me\/91\d{10}\?text=/);
  assert.match(decodeURIComponent(wa), /verified your payment/);
  await drawer.getByRole("button", { name: "Move to production" }).click();
  await toast(admin, "Marked in production").waitFor();
  await drawer.getByRole("button", { name: "Mark ready" }).click();
  await toast(admin, "Marked ready").waitFor();
  const history = await drawer.getByRole("heading", { name: "History" }).locator("xpath=..").innerText();
  for (const line of ["Order placed", "Customer shared a UTR", "Payment verified", "Item edited", "Note updated", "Moved to production", "Marked ready for pickup"]) assert.match(history, new RegExp(line), `history shows "${line}"`);
  assert.match(history, /name "ARYAN" → "ARYAN K\."/);
  await shot(admin, L, "05-drawer-after");
  await drawer.getByRole("button", { name: "Close order" }).click();

  // the customer sees it on their side
  await A.page.goto(`${BASE}/orders`);
  await A.page.getByText("Payment verified").first().waitFor();
  assert.match(await A.page.getByRole("list", { name: "Order progress" }).innerText(), /Ready for pickup/);
  await A.page.getByText("ARYAN K.").first().waitFor();

  // ---- second order: verify, start a refund, cancel flow ----
  await admin.goto(`${BASE}/admin/orders?order=${B.code}`);
  const dB = admin.getByRole("dialog", { name: `Order ${B.code}` });
  await dB.getByRole("button", { name: "Verify payment" }).click();
  await toast(admin, "Payment verified").waitFor();
  await dB.getByRole("button", { name: "Start refund" }).click();
  await toast(admin, "Refund requested").waitFor();
  await shot(admin, L, "06-drawer-refund");
  await dB.getByRole("button", { name: "Close order" }).click();

  // ---- dashboard numbers ----
  await admin.goto(`${BASE}/admin`);
  const tile = (name) => admin.getByText(name, { exact: true }).locator("..");
  assert.match(await tile("Verified revenue").innerText(), /₹2,997/, "999 + 1,998 while the refund is only requested");
  assert.match(await tile("Pending verifications").innerText(), /1/);
  assert.match(await tile("Open refunds").innerText(), /1/);
  assert.match(await tile("Items to make").innerText(), /3/);
  await admin.getByText("View as table").click();
  const sizeTable = await admin.locator("details table").innerText();
  assert.match(sizeTable, /L\s+3/, "Aryan's edited size L (1) plus Sam's two");
  await shot(admin, L, "07-dashboard-after");
  await overflow(admin, L, "dashboard after");

  // approve the refund: revenue and items drop
  await admin.goto(`${BASE}/admin/orders?order=${B.code}`);
  await admin.getByRole("dialog").getByRole("button", { name: "Approve refund" }).click();
  await toast(admin, "Refund approved").waitFor();
  await admin.goto(`${BASE}/admin`);
  assert.match(await tile("Verified revenue").innerText(), /₹999/);
  assert.doesNotMatch(await tile("Verified revenue").innerText(), /2,997/);

  // ---- vendor sheet + CSV ----
  await admin.goto(`${BASE}/admin/vendor`);
  await admin.getByRole("heading", { name: "Vendor sheet" }).waitFor();
  assert.match(await admin.getByRole("region", { name: /Units by product/ }).innerText(), /IIT Bombay Hoodie/);
  await shot(admin, L, "08-vendor");
  const [download] = await Promise.all([admin.waitForEvent("download"), admin.getByRole("link", { name: "Download CSV" }).click()]);
  const csv = await (await import("node:fs/promises")).readFile(await download.path(), "utf8");
  assert.match(csv, /^﻿product,colour,size,name,quantity,order_code/);
  assert.match(csv, new RegExp(`IIT Bombay Hoodie,Black,L,ARYAN K\\.,1,${A.code}`));
  assert.ok(!csv.includes(B.code), "a refunded order is not made");
  for (const secret of [A.email, B.email, "Aryan Kumar", "412345678901", "Hostel 4"]) assert.ok(!csv.includes(secret), `vendor CSV must not contain ${secret}`);

  // ---- batches ----
  await admin.goto(`${BASE}/admin/batches`);
  await admin.getByRole("heading", { name: "Batches" }).waitFor();
  await shot(admin, L, "09-batches");
  await admin.getByText("New batch").click();
  await admin.getByLabel("Name").first().fill("Batch 02");
  await admin.getByLabel("Estimated delivery").first().fill("Around 25 Nov");
  await admin.getByRole("button", { name: "Create batch" }).click();
  await toast(admin, "Created Batch 02").waitFor();
  await admin.getByText("Accepting orders").waitFor();
  const cards = admin.locator("ul > li").filter({ has: admin.getByRole("heading", { level: 2 }) });
  assert.equal(await cards.filter({ hasText: "Batch 02" }).getByText("Accepting orders").count(), 1);
  assert.equal(await cards.filter({ hasText: "Batch 01" }).getByText("Accepting orders").count(), 0, "opening Batch 02 closed Batch 01");
  // the storefront follows the batch
  const shopPage = await custCtx.newPage();
  await shopPage.goto(`${BASE}/shop`);
  await shopPage.getByText(/Batch 02 · preorder/).first().waitFor();
  await shopPage.close();
  // put things back so the next steps use Batch 01
  await cards.filter({ hasText: "Batch 01" }).getByRole("button", { name: "Open", exact: true }).click();
  await toast(admin, "Batch opened").waitFor();
  await shot(admin, L, "10-batches-after");

  // ---- products: create, appears in shop, edit price, hide ----
  await admin.goto(`${BASE}/admin/products`);
  await shot(admin, L, "11-products");
  await admin.getByRole("link", { name: "New product" }).click();
  await admin.getByLabel("Name", { exact: true }).fill("Lake Hoodie");
  assert.equal(await admin.getByLabel(/Slug/).inputValue(), "lake-hoodie", "slug follows the name");
  await admin.getByLabel("Sizes").fill("M, L, xl");
  await admin.getByLabel("Price (₹)").fill("1099");
  await admin.getByLabel("Colourway name").fill("Lake");
  await shot(admin, L, "12-product-form");
  await admin.getByRole("button", { name: "Create product" }).click();
  await admin.waitForURL(/\/admin\/products$/);
  const shop2 = await custCtx.newPage();
  await shop2.goto(`${BASE}/shop`);
  await shop2.getByText("Lake Hoodie").first().waitFor();
  await shop2.goto(`${BASE}/shop/lake-hoodie`);
  await shop2.getByText("₹1,099").first().waitFor();
  assert.ok((await shop2.locator("label.chip").allInnerTexts()).includes("XL"), "sizes were normalised");
  // Pages you leave stay mounted (hidden), so scope to what is actually on screen.
  await admin.getByRole("link", { name: "Lake Hoodie" }).first().click();
  await admin.getByRole("heading", { name: "Lake Hoodie", level: 1 }).waitFor();
  await admin.getByLabel("Price (₹)").locator("visible=true").fill("1199");
  await admin.getByRole("button", { name: "Save product" }).locator("visible=true").click();
  await toast(admin, "Product saved").waitFor();
  await shop2.reload();
  await shop2.getByText("₹1,199").first().waitFor();
  await admin.goto(`${BASE}/admin/products`);
  await admin.getByRole("button", { name: "Hide Lake Hoodie" }).click();
  await toast(admin, "hidden from the shop").waitFor();
  await shop2.goto(`${BASE}/shop/lake-hoodie`);
  await shop2.getByRole("heading", { name: "Gone." }).waitFor(); // the not-found page, not the product
  await shop2.goto(`${BASE}/shop`);
  await shop2.getByText("IIT Bombay Hoodie").first().waitFor();
  assert.equal(await shop2.getByText("Lake Hoodie").count(), 0, "a hidden product leaves the shop grid");
  await admin.getByRole("button", { name: "Show Lake Hoodie" }).click().catch(() => admin.getByRole("button", { name: "Make live" }).first().click());
  await shop2.close();

  // ---- customers ----
  await admin.goto(`${BASE}/admin/customers`);
  await shot(admin, L, "13-customers");
  await admin.getByPlaceholder(/Search name/).fill("sam");
  await admin.getByPlaceholder(/Search name/).press("Enter");
  await admin.getByRole("link", { name: "Sam Lee" }).click();
  await admin.getByRole("heading", { name: "Sam Lee" }).waitFor();
  await admin.getByLabel("Full name").fill("Sam Lee Jr");
  await admin.getByRole("button", { name: "Save customer" }).click();
  await toast(admin, "Customer saved").waitFor();
  await admin.getByLabel(/New password/).fill("short");
  await admin.getByRole("button", { name: "Set new password" }).click();
  await admin.getByText(/at least 8/i).first().waitFor();
  await admin.getByLabel(/New password/).fill("new-pass-1234");
  await admin.getByRole("button", { name: "Set new password" }).click();
  await admin.getByText("new-pass-1234").waitFor();
  assert.match((await admin.getByRole("link", { name: "Send on WhatsApp" }).getAttribute("href")) ?? "", /wa\.me\/91/);
  await shot(admin, L, "14-customer-detail");
  await admin.getByRole("link", { name: B.code }).waitFor();
  // Sam logs in with the new password, and the old one stops working
  const samPage = await (await browser.newContext()).newPage();
  await samPage.goto(`${BASE}/login`);
  await samPage.getByLabel("Email").fill(B.email);
  await samPage.getByLabel("Password", { exact: true }).fill(B.password);
  await samPage.getByRole("button", { name: "Log in", exact: true }).click();
  await samPage.getByText("That email and password don't match.").waitFor();
  await samPage.getByLabel("Password", { exact: true }).fill("new-pass-1234");
  await samPage.getByRole("button", { name: "Log in", exact: true }).click();
  await samPage.getByRole("button", { name: /Account menu/ }).waitFor();
  await samPage.context().close();

  // ---- settings: edit business values and watch them go live ----
  await admin.goto(`${BASE}/admin/settings`);
  await admin.getByRole("heading", { name: /things left before launch|5 things/ }).waitFor();
  await shot(admin, L, "15-settings");
  await admin.getByLabel("UPI ID").fill("aryan@oksbi");
  await admin.getByLabel("Payee name").fill("Aryan Kumar");
  await admin.getByLabel("Phone", { exact: true }).fill("919812345678");
  await admin.getByLabel("WhatsApp number").fill("919812345678");
  await admin.getByLabel("Room", { exact: true }).fill("Room 112");
  await admin.getByLabel("Hours").fill("6–9 pm, weekdays");
  await admin.getByLabel("Refund window (days)").fill("7");
  await admin.getByLabel("Row 2 size").locator("..").locator("..").getByLabel("M Chest").fill("54");
  await admin.getByRole("button", { name: "Save settings" }).click();
  await toast(admin, "Settings saved").waitFor();
  await admin.reload();
  await admin.getByRole("heading", { name: "Setup complete" }).waitFor();
  const payer = await custCtxC.newPage();
  await payer.goto(`${BASE}/order/${C.code}/pay`);
  await payer.getByText("aryan@oksbi").first().waitFor();
  assert.match(await payer.locator("body").innerText(), /within 7 days of pickup/);
  assert.match(await payer.locator("body").innerText(), /Room 112, 6–9 pm, weekdays/);
  assert.match((await payer.getByRole("link", { name: "WhatsApp Aryan" }).first().getAttribute("href")) ?? "", /wa\.me\/919812345678/);
  assert.match((await payer.locator('img[alt^="UPI QR"]').getAttribute("alt")) ?? "", /order HD-/);
  await payer.close();
  // cached pages (policies + footer) follow the settings tag too
  const policies = await custCtxC.newPage();
  await policies.goto(`${BASE}/policies`);
  await policies.getByText("within 7 days of pickup").first().waitFor();
  assert.match(await policies.locator("footer").innerText(), /Room 112/, "the footer shows the new pickup room");
  assert.match((await policies.locator("footer").getByRole("link", { name: "WhatsApp" }).getAttribute("href")) ?? "", /wa\.me\/919812345678/);
  await policies.close();
  // an invalid value is refused inline
  await admin.getByLabel("UPI ID").fill("not a upi id");
  await admin.getByRole("button", { name: "Save settings" }).click();
  await admin.getByText("Use the form name@bank").waitFor();
  await admin.getByLabel("UPI ID").fill("aryan@oksbi");

  // logout locks the panel again
  await admin.getByRole("button", { name: "Log out" }).click();
  await admin.waitForURL(/\/admin\/login/);
  await admin.goto(`${BASE}/admin/orders`);
  await admin.waitForURL(/\/admin\/login\?next=%2Fadmin%2Forders/);

  // ===================== phone admin =====================
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await phone.newPage();
  watch(p, "admin phone");
  const P = "phone";
  await adminLogin(p, P);
  await p.getByRole("heading", { name: "Dashboard" }).waitFor();
  await shot(p, P, "02-dashboard");
  await overflow(p, P, "dashboard");
  await p.goto(`${BASE}/admin/orders`);
  await p.getByRole("heading", { name: "Orders" }).waitFor();
  await shot(p, P, "03-orders");
  await overflow(p, P, "orders");
  await p.getByRole("link", { name: new RegExp(A.code) }).first().click();
  await p.getByRole("dialog").waitFor();
  await shot(p, P, "04-drawer");
  await p.getByRole("dialog").getByRole("button", { name: "Close order" }).click();
  for (const [path, name] of [["/admin/batches", "05-batches"], ["/admin/products", "06-products"], ["/admin/customers", "07-customers"], ["/admin/vendor", "08-vendor"], ["/admin/settings", "09-settings"]]) {
    await p.goto(`${BASE}${path}`);
    await p.locator("h1").waitFor();
    await shot(p, P, name);
    await overflow(p, P, path);
  }
  await p.goto(`${BASE}/admin/products/new`);
  await shot(p, P, "10-product-form");
  await overflow(p, P, "product form");
} finally {
  await browser.close(); // never leave a browser behind
}
console.log(problems.length ? `PROBLEMS:\n${problems.join("\n")}` : "admin walkthrough passed: no console errors or overflow");
process.exit(problems.length ? 1 : 0);

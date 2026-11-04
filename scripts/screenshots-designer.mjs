// Drives the designer feature in a real browser and screenshots every designer and admin page at phone and desktop size.
//   npm run with-server -- node scripts/screenshots-designer.mjs --out=<dir>   (CHROMIUM_PATH picks a browser build)
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import sharp from "sharp";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = arg("out", "scripts/.out/shots-designer");
mkdirSync(OUT, { recursive: true });

const stamp = Date.now();
const password = "correct horse battery";
const title = "Lakeside Dusk";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] });
const problems = [];
const ctxOpts = { baseURL: BASE, reducedMotion: "reduce", viewport: { width: 1440, height: 900 } };
const open = async (label) => {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`[${label}] pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/404|401|307/.test(m.text()) && problems.push(`[${label}] console: ${m.text()}`));
  return page;
};

// A flat poster-like image per design, so the thumbnails look like real artwork.
const art = (bg, fg, word) =>
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1250"><rect width="1000" height="1250" fill="${bg}"/><circle cx="500" cy="520" r="260" fill="${fg}"/><rect x="0" y="780" width="1000" height="470" fill="#0b0b0c" opacity=".55"/><text x="500" y="1010" font-family="sans-serif" font-size="96" font-weight="700" text-anchor="middle" fill="#fff">${word}</text></svg>`)).jpeg().toBuffer();

async function shot(page, name) {
  for (const [label, vp] of [["phone", { width: 390, height: 844 }], ["desktop", { width: 1440, height: 900 }]]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(300);
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: vp.width, height: Math.min(Math.max(h, vp.height), 3400) }); // a tall viewport avoids sticky-nav artefacts of fullPage
    await page.waitForFunction(() => [...document.images].every((i) => i.complete)).catch(() => {});
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${name}.${label}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  console.log("shot", name);
}

const guest = await open("guest");
const designer = await open("designer");
const admin = await open("admin");
const buyer = await open("buyer");

// ---- guest sees the pitch; applying leaves the designer on the waiting panel
await guest.goto("/designers");
await shot(guest, "01-designers-landing");
await designer.goto("/designers");
await designer.getByLabel("Full name").fill("Dia Designer");
await designer.getByLabel("Email").fill(`dia.${stamp}@example.com`);
await designer.getByLabel("Password", { exact: true }).fill(password);
await designer.getByLabel("Phone").fill("98765 4" + String(stamp).slice(-4));
await designer.getByLabel(/About you/).fill("Print designer from the Powai art club. Posters, mostly.");
await designer.getByLabel(/UPI ID/).fill("dia@okbank");
await designer.locator("label", { hasText: /designer terms/ }).click({ position: { x: 12, y: 12 } });
await designer.getByRole("button", { name: "Create designer account" }).click();
await designer.waitForURL(/\/designer$/);
await shot(designer, "02-designer-pending");

// ---- admin approves
await admin.goto("/admin");
await admin.getByLabel("Admin password").fill(process.env.ADMIN_PASSWORD ?? "admin");
await admin.getByRole("button", { name: "Log in" }).click();
await admin.waitForURL(/\/admin$/);
await admin.goto("/admin/designers");
await shot(admin, "03-admin-designers-list");
await admin.getByRole("link", { name: "Dia Designer" }).first().click();
await admin.waitForURL(/\/admin\/designers\/[0-9a-f-]{36}$/);
const designerAdminUrl = admin.url();
await shot(admin, "04-admin-designer-pending");
await admin.getByLabel(/Commission \(% of profit\)/).fill("6");
await admin.getByRole("button", { name: "Approve", exact: true }).click();
await admin.getByText("Designer approved.").waitFor();

// ---- designer: empty dashboard, then a new design
await designer.goto("/designer");
await shot(designer, "05-designer-dashboard-empty");
await designer.goto("/designer/designs/new");
await shot(designer, "06-designer-new-design");
await designer.getByLabel("Title").fill(title);
await designer.locator("label.chip", { hasText: "Hoodie" }).click();
await designer.locator("label.chip", { hasText: "Black" }).click();
await designer.locator("label.chip", { hasText: "Off-white" }).click().catch(() => {});
await designer.getByLabel(/Description/).fill("Dusk over Powai lake, screen printed in two inks.");
await designer.getByLabel(/Price you suggest/).fill("899");
await designer.locator("label", { hasText: /my own work/ }).click({ position: { x: 12, y: 12 } });
await designer.getByRole("button", { name: "Create design and add images" }).click();
await designer.waitForURL(/\/designer\/designs\/[0-9a-f-]{36}/);
const designUrl = new URL(designer.url()).pathname;
await shot(designer, "07-designer-design-draft-no-images");
await designer.getByTestId("design-image-input").setInputFiles([
  { name: "front.jpg", mimeType: "image/jpeg", buffer: await art("#1c3a5e", "#ff7a3d", "LAKESIDE") },
  { name: "back.jpg", mimeType: "image/jpeg", buffer: await art("#5e1c2f", "#ffd27a", "DUSK") },
]);
await designer.getByRole("img", { name: "Design image 2" }).waitFor();
await shot(designer, "08-designer-design-draft");
await designer.getByRole("button", { name: "Send for review" }).click();
await designer.getByText(/team is looking at it/i).waitFor();
await shot(designer, "09-designer-design-in-review");

// ---- admin reviews: changes, resubmit, approve, publish
await admin.goto("/admin/designs");
await shot(admin, "10-admin-designs-list");
await admin.getByRole("link", { name: new RegExp(title) }).first().click();
await admin.waitForURL(/\/admin\/designs\/[0-9a-f-]{36}$/);
const reviewUrl = admin.url();
await shot(admin, "11-admin-design-review");
await admin.getByLabel("Note to the designer").fill("Lovely. Please add a flat back view too.");
await admin.getByRole("button", { name: "Request changes" }).click();
await admin.getByText("Sent back to the designer.").first().waitFor();
await designer.goto(designUrl);
await shot(designer, "12-designer-changes-requested");
await designer.getByRole("button", { name: "Send back for review" }).click();
await designer.getByText(/team is looking at it/i).waitFor();
await admin.goto(reviewUrl);
await admin.getByRole("button", { name: "Approve", exact: true }).click();
await admin.getByText(/Design approved/).first().waitFor();
await admin.reload();
await admin.getByLabel("Selling price (₹)").fill("899");
await admin.getByLabel(/Cost to make/).fill("500");
await admin.getByRole("status").filter({ hasText: /earns/ }).waitFor();
await shot(admin, "13-admin-design-publish");
const slug = await admin.getByLabel("Web address (slug)").inputValue();
await admin.getByRole("button", { name: "Put it live" }).click();
await admin.getByText(/live/i).first().waitFor();
await admin.goto(reviewUrl);
await shot(admin, "14-admin-design-live");

// ---- two orders: one paid, one still waiting
const buy = async (qty, first) => {
  await buyer.goto(`/shop/${slug}`);
  await buyer.locator("label.chip", { hasText: /^M$/ }).click();
  for (let i = 1; i < qty; i++) await buyer.getByRole("button", { name: "Increase quantity" }).click();
  await buyer.getByRole("button", { name: /Add to cart/ }).click();
  await buyer.goto("/checkout");
  if (first) {
    await buyer.getByRole("tab", { name: "Create account" }).click();
    await buyer.getByLabel("Full name").fill("Bo Buyer");
    await buyer.getByLabel("Email").fill(`bo.${stamp}@example.com`);
    await buyer.getByLabel("Password", { exact: true }).fill(password);
    await buyer.getByLabel("Phone").fill("98765 5" + String(stamp).slice(-4));
    await buyer.getByRole("button", { name: "Create account" }).click();
    await buyer.waitForURL(/\/checkout$/);
  }
  await buyer.getByLabel("Your hostel").fill("Hostel 9");
  await buyer.getByLabel("Your room number").fill("101");
  await buyer.locator("label", { hasText: "I confirmed the name spelling" }).click({ position: { x: 12, y: 12 } });
  await buyer.locator("label", { hasText: /read the/ }).click({ position: { x: 12, y: 12 } });
  await buyer.getByRole("button", { name: /Place order/i }).click();
  await buyer.waitForURL(/\/order\/HD-[A-Z0-9]{4}\/pay/);
  return buyer.url().match(/HD-[A-Z0-9]{4}/)[0];
};
const paid = await buy(2, true);
await buy(1, false); // stays pending
await admin.goto("/admin/orders");
await admin.locator("tbody tr").filter({ hasText: paid }).click();
await admin.getByRole("dialog", { name: `Order ${paid}` }).getByRole("button", { name: "Verify payment" }).click();
await admin.getByText("Payment verified").first().waitFor();

// ---- the designer's numbers, then a part payout
await designer.goto("/designer");
await shot(designer, "15-designer-dashboard");
await designer.goto("/designer/designs");
await shot(designer, "16-designer-designs");
await designer.goto("/designer/earnings");
await shot(designer, "17-designer-earnings");
await admin.goto(designerAdminUrl);
await admin.getByLabel("Amount sent (₹)").fill("20");
await admin.getByLabel("UTR / reference").fill("UTR-DEMO-0001");
await admin.getByRole("button", { name: "Record payout" }).click();
await admin.getByText(/Recorded|payout/i).first().waitFor();
await shot(admin, "18-admin-designer-approved");
await designer.goto("/designer/earnings");
await shot(designer, "19-designer-earnings-paid");
await designer.goto("/designer/profile");
await shot(designer, "20-designer-profile");
await admin.goto("/admin/products");
await admin.getByRole("link", { name: new RegExp(title) }).first().click();
await admin.waitForURL(/\/admin\/products\/[0-9a-f-]{36}$/);
await shot(admin, "21-admin-product-terms");
await guest.goto("/policies#designers");
await shot(guest, "22-policies");

await browser.close();
if (problems.length) {
  console.error("\nBrowser problems:\n" + problems.join("\n"));
  process.exit(1);
}
console.log("\nAll screenshots taken, no console errors.");

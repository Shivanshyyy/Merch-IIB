// Walks the storefront at phone + desktop sizes, saving screenshots. Usage:
//   node scripts/screenshots.mjs --base=http://localhost:3100 --out=<dir>
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const BASE = arg("base", "http://localhost:3100");
const OUT = arg("out", "scripts/.out/shots");
const SIZES = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const problems = [];

for (const [label, viewport] of Object.entries(SIZES)) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: label === "phone" ? 2 : 1, hasTouch: label === "phone", isMobile: label === "phone" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`[${label}] pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && problems.push(`[${label}] console: ${m.text()}`));
  // The /nope visit is meant to 404; any other missing resource is a bug.
  page.on("response", (r) => r.status() === 404 && !r.url().endsWith("/nope") && problems.push(`[${label}] 404: ${r.url()}`));
  const shot = async (name, opts = {}) => {
    await page.waitForTimeout(700); // let entrance transitions settle
    await page.screenshot({ path: `${OUT}/${label}-${name}.png`, ...opts });
  };
  const overflow = async (name) => {
    const w = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (w > 0) problems.push(`[${label}] horizontal overflow ${w}px on ${name}`);
  };

  await page.goto(`${BASE}/`);
  await shot("01-home");
  await overflow("home");
  await shot("01-home-full", { fullPage: true });

  await page.goto(`${BASE}/shop`);
  await shot("02-shop");
  await overflow("shop");

  await page.goto(`${BASE}/shop/midnight-flame`);
  await shot("03-product");
  await overflow("product");
  await page.locator("label.chip", { hasText: /^M$/ }).click();
  await page.getByLabel(/Name on the back/i).fill("aryan k.");
  await shot("04-product-name-preview");
  await page.getByRole("button", { name: /Add to cart/i }).click();
  await page.waitForTimeout(300);
  await shot("05-added-toast");

  await page.getByRole("button", { name: /Open cart/i }).click();
  await shot("06-drawer");
  await page.keyboard.press("Escape");

  await page.goto(`${BASE}/cart`);
  await shot("07-cart");
  await overflow("cart");

  await page.goto(`${BASE}/checkout`);
  await page.getByRole("button", { name: /Place order/i }).waitFor();
  await page.getByRole("button", { name: /Place order/i }).click();
  await shot("08-checkout-errors");
  await page.getByLabel("Full name").fill("Aryan Kumar");
  await page.getByLabel("Email").fill(`aryan+${label}${Date.now()}@example.com`);
  await page.getByLabel("Phone").fill("98765 43210");
  await page.getByLabel("Hostel").fill("Hostel 4");
  await page.getByLabel("Room").fill("112");
  await page.locator("label", { hasText: "I confirmed the name spelling" }).click({ position: { x: 12, y: 12 } });
  await page.locator("label", { hasText: /read the/ }).click({ position: { x: 12, y: 12 } });
  await shot("09-checkout-filled");
  await overflow("checkout");
  await page.getByRole("button", { name: /Place order/i }).click();
  await page.waitForURL(/\/order\/HD-[A-Z0-9]{4}\/pay/, { timeout: 15000 });
  const code = page.url().match(/HD-[A-Z0-9]{4}/)[0];
  await page.getByText("Your order code").waitFor();
  await shot("10-pay");
  await shot("10-pay-full", { fullPage: true });
  await overflow("pay");
  await page.getByRole("textbox", { name: /UTR/i }).fill("412345678901");
  await page.getByRole("button", { name: "Save UTR" }).click();
  await page.getByText(/Got it/).waitFor();
  await page.getByRole("button", { name: /Copy UPI ID/i }).click();
  await page.waitForTimeout(250);
  await shot("11-pay-utr-copied");

  await page.goto(`${BASE}/track`);
  await shot("12-track-prefilled");
  await page.getByRole("button", { name: "Check status" }).click();
  await page.getByRole("list", { name: "Order progress" }).first().waitFor();
  await shot("13-track-result");
  await overflow("track");
  console.log(`[${label}] placed order ${code}`);

  await page.goto(`${BASE}/policies`);
  await shot("14-policies");
  await overflow("policies");
  await page.goto(`${BASE}/cart`);
  await shot("15-cart-empty");
  await page.goto(`${BASE}/nope`);
  await shot("16-404");
  await overflow("404");
  await ctx.close();
}
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join("\n")}` : "no console errors or overflow");

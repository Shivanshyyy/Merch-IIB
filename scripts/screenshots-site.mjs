// Walks the customer storefront (browse -> sign up -> checkout -> pay -> orders -> account) at phone + desktop sizes.
//   npm run with-server -- node scripts/screenshots-site.mjs --out=<dir>
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = arg("out", "scripts/.out/shots-site");
const SIZES = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
mkdirSync(OUT, { recursive: true });

const problems = [];
const browser = await chromium.launch();
try {
  for (const [label, viewport] of Object.entries(SIZES)) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: label === "phone" ? 2 : 1, hasTouch: label === "phone", isMobile: label === "phone" });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => problems.push(`[${label}] pageerror: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && problems.push(`[${label}] console: ${m.text()}`));
    page.on("response", (r) => r.status() === 404 && !r.url().endsWith("/nope") && problems.push(`[${label}] 404: ${r.url()}`));

    const shot = async (name, opts = {}) => {
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/${label}-${name}.png`, ...opts });
    };
    const overflow = async (name) => {
      const w = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (w > 0) problems.push(`[${label}] horizontal overflow ${w}px on ${name}`);
    };
    const email = `shopper+${label}${Date.now()}@example.com`;
    const password = "correct horse battery";

    await page.goto(`${BASE}/`);
    await shot("01-home");
    await overflow("home");

    // browse + build a cart while logged out
    await page.goto(`${BASE}/shop/midnight-flame`);
    await page.locator("label.chip", { hasText: /^M$/ }).click();
    await page.getByLabel(/Name on the back/i).fill("aryan k.");
    await page.getByRole("button", { name: /Add to cart/i }).click();
    await page.waitForTimeout(300);

    // logged out: checkout asks for an account
    await page.goto(`${BASE}/checkout`);
    await page.getByRole("tab", { name: "Log in" }).waitFor();
    await shot("02-checkout-login-gate");
    await overflow("checkout gate");

    // sign-up with inline errors first
    await page.getByRole("tab", { name: "Create account" }).click();
    await page.getByRole("button", { name: "Create account" }).click();
    await shot("03-signup-errors");
    await page.getByLabel("Full name").fill("Aryan Kumar");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByLabel("Phone").fill("98765 43210");
    await page.getByLabel("Roll no. (optional)").fill("22B1234");
    await page.getByLabel("Usual size (optional)").selectOption("M");
    await page.getByLabel("Phone").focus(); // blur the password field so its error shows
    await shot("04-signup-weak-password");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await overflow("signup");
    await shot("05-signup-filled");
    await page.getByRole("button", { name: "Create account" }).click();

    // lands back on checkout, cart intact, details prefilled
    await page.waitForURL(/\/checkout$/, { timeout: 15000 });
    await page.getByRole("button", { name: /Place order/i }).waitFor();
    if ((await page.getByLabel("Full name").inputValue()) !== "Aryan Kumar") problems.push(`[${label}] checkout did not prefill the name`);
    await page.getByLabel("Hostel").fill("Hostel 4");
    await page.getByLabel("Room").fill("112");
    await page.locator("label", { hasText: "I confirmed the name spelling" }).click({ position: { x: 12, y: 12 } });
    await page.locator("label", { hasText: /read the/ }).click({ position: { x: 12, y: 12 } });
    await shot("06-checkout-prefilled");
    await overflow("checkout");
    await page.getByRole("button", { name: /Place order/i }).click();
    await page.waitForURL(/\/order\/HD-[A-Z0-9]{4}\/pay/, { timeout: 15000 });
    const code = page.url().match(/HD-[A-Z0-9]{4}/)[0];
    await page.getByText("Your order code").waitFor();
    await shot("07-pay");
    await overflow("pay");

    // account menu
    await page.getByRole("button", { name: /Account menu/ }).click();
    await shot("08-account-menu");
    await page.getByRole("menuitem", { name: "My orders" }).click();
    await page.waitForURL(/\/orders$/);
    await page.getByRole("list", { name: "Order progress" }).first().waitFor();
    await shot("09-orders");
    await overflow("orders");

    await page.goto(`${BASE}/account`);
    await page.getByRole("button", { name: "Change password" }).waitFor();
    await shot("10-account");
    await overflow("account");

    // old track link now lands on My orders
    await page.goto(`${BASE}/track`);
    if (!page.url().endsWith("/orders")) problems.push(`[${label}] /track did not redirect to /orders (${page.url()})`);

    // log out, wrong password, right password
    await page.getByRole("button", { name: /Account menu/ }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await page.waitForURL(`${BASE}/`);
    await page.goto(`${BASE}/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("not the password");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.getByText("That email and password don't match.").waitFor();
    await shot("11-login-wrong-password");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL(`${BASE}/`);
    await page.getByRole("button", { name: /Account menu/ }).waitFor();
    console.log(`[${label}] account ${email}, order ${code}`);

    await page.goto(`${BASE}/policies`);
    await shot("12-policies");
    await overflow("policies");
    await page.goto(`${BASE}/cart`);
    await shot("13-cart-empty");
    await page.goto(`${BASE}/nope`);
    await shot("14-404");
    await overflow("404");
    await ctx.close();
  }
} finally {
  await browser.close(); // never leave a browser behind
}
console.log(problems.length ? `PROBLEMS:\n${problems.join("\n")}` : "no console errors, 404s or overflow");
process.exit(problems.length ? 1 : 0);

// Axe accessibility scan (WCAG 2 A/AA + best practice) of every page at phone and desktop size.
// Fails on any serious or critical violation. Also checks the saved-size preselect after login.
//   npm run with-server -- node scripts/a11y.mjs [--admin]
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const withAdmin = process.argv.includes("--admin");
const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

const PUBLIC = ["/", "/shop", "/shop/ash", "/cart", "/checkout", "/login", "/policies", "/nope"];
const AUTHED = ["/orders", "/account"];
const ADMIN = ["/admin", "/admin/orders", "/admin/batches", "/admin/products", "/admin/customers", "/admin/settings"];

const failures = [];
const notes = [];
const browser = await chromium.launch();
try {
  for (const [label, viewport] of [["phone", { width: 390, height: 844 }], ["desktop", { width: 1440, height: 900 }]]) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();

    const scan = async (path) => {
      await page.goto(`${BASE}${path}`);
      await page.waitForLoadState("networkidle");
      await page.addScriptTag({ content: axeSource });
      const found = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] });
        return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, html: v.nodes[0].html.slice(0, 120), why: (v.nodes[0].any[0]?.message ?? v.help).slice(0, 140) }));
      });
      for (const v of found) {
        const line = `[${label}] ${path} ${v.impact} ${v.id} x${v.n}: ${v.html} :: ${v.why}`;
        (v.impact === "critical" || v.impact === "serious" ? failures : notes).push(line);
      }
    };

    for (const p of PUBLIC) await scan(p);

    // sign up with a saved size, then scan the logged-in pages
    await page.goto(`${BASE}/login?mode=signup`);
    await page.getByLabel("Full name").fill("A11y Tester");
    await page.getByLabel("Email").fill(`a11y+${label}${Date.now()}@example.com`);
    await page.getByLabel("Password", { exact: true }).fill("correct horse battery");
    await page.getByLabel("Phone").fill("9876543210");
    await page.getByLabel("Usual size (optional)").selectOption("L");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByRole("button", { name: /Account menu/ }).waitFor();
    for (const p of AUTHED) await scan(p);

    await page.goto(`${BASE}/shop/ash`);
    await page.locator("label.chip:has(input:checked)", { hasText: /^L$/ }).waitFor({ timeout: 5000 }).catch(() => failures.push(`[${label}] saved size L was not preselected on the product page`));

    if (withAdmin) {
      await page.goto(`${BASE}/admin/login`);
      await page.getByLabel("Password").fill(process.env.ADMIN_PASSWORD ?? "admin");
      await page.getByRole("button", { name: /log in/i }).click();
      await page.waitForURL(/\/admin$/);
      for (const p of ADMIN) await scan(p);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
notes.forEach((n) => console.log("note  ", n));
console.log(failures.length ? `FAIL (${failures.length})\n${failures.join("\n")}` : "axe: no serious or critical violations");
process.exit(failures.length ? 1 : 0);

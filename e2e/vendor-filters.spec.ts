import { expect, test } from "@playwright/test";

// A paid order with a zip hoodie and a regular tee, then the admin cuts the vendor sheet by garment kind and by style.
// Runs against the in-memory demo store, where the admin password is "admin".

const stamp = Date.now();

test("vendor sheet: filter by hoodies / tees, then by style, and the CSV follows the filter", async ({ page, browser }) => {
  await page.goto("/shop/iit-bombay-zip-hoodie");
  await page.locator("label.chip", { hasText: /^M$/ }).click();
  await page.getByRole("button", { name: /Add to cart/ }).click();
  await expect(page.getByRole("button", { name: /Open cart, 1 items/ })).toBeVisible();
  await page.goto("/shop/regular-tee");
  await page.locator("label.chip", { hasText: /^L$/ }).click();
  await page.getByRole("button", { name: /Add to cart/ }).click();
  await expect(page.getByRole("button", { name: /Open cart, 2 items/ })).toBeVisible();

  await page.getByRole("button", { name: /Open cart/ }).click();
  await page.getByRole("dialog").getByRole("link", { name: /checkout/i }).click();
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Full name").fill("Vendor Tester");
  await page.getByLabel("Email").fill(`vendor.${stamp}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("correct horse battery");
  await page.getByLabel("Phone").fill(`98765 5${String(stamp).slice(-4)}`);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/checkout$/);
  await page.getByLabel("Your hostel").fill("Hostel 12");
  await page.getByLabel("Your room number").fill("214");
  await page.locator("label", { hasText: "I confirmed the name spelling" }).click({ position: { x: 12, y: 12 } });
  await page.locator("label", { hasText: /read the/ }).click({ position: { x: 12, y: 12 } });
  await page.getByRole("button", { name: /Place order/i }).click();
  await page.waitForURL(/\/order\/HD-[A-Z0-9]{4}\/pay/);
  const code = page.url().match(/HD-[A-Z0-9]{4}/)![0];

  const ctx = await browser.newContext({ baseURL: process.env.BASE_URL ?? "http://localhost:3000", reducedMotion: "reduce" });
  const admin = await ctx.newPage();
  await admin.goto("/admin/login");
  await admin.getByLabel("Admin password").fill(process.env.ADMIN_PASSWORD ?? "admin");
  await admin.getByRole("button", { name: "Log in" }).click();
  await admin.waitForURL(/\/admin$/);
  await admin.locator("nav[aria-label=Admin]").getByRole("link", { name: /^Orders/ }).click();
  await admin.locator("tbody tr").filter({ hasText: code }).click();
  await admin.getByRole("dialog", { name: `Order ${code}` }).getByRole("button", { name: "Verify payment" }).click();
  await expect(admin.locator('[role="status"]').filter({ hasText: "Payment verified" }).first()).toBeVisible();

  await admin.goto("/admin/vendor");
  const filters = admin.getByRole("navigation", { name: "Filter by garment" });
  const lines = admin.locator("section[aria-labelledby=lines-h] tbody tr");
  await expect(filters.getByRole("link", { name: /^All/ })).toHaveAttribute("aria-current", "true");
  await expect(lines).toHaveCount(2);

  await filters.getByRole("link", { name: /^Hoodies/ }).click();
  await expect(lines).toHaveCount(1);
  await expect(lines.first()).toContainText("Zip Hoodie");
  await expect(admin).toHaveURL(/type=hoodie/);

  await filters.getByRole("link", { name: /^Tees/ }).click();
  await expect(lines).toHaveCount(1);
  await expect(lines.first()).toContainText("Regular T-shirt");

  const [download] = await Promise.all([admin.waitForEvent("download"), admin.getByRole("link", { name: /Download CSV \(filtered\)/ }).click()]);
  expect(download.suggestedFilename()).toContain("tee");
  const csv = await (await import("node:fs/promises")).readFile((await download.path())!, "utf8");
  expect(csv).toContain("Regular T-shirt");
  expect(csv).not.toContain("Zip Hoodie");

  await ctx.close();
});

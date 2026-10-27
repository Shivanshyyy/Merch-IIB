import { expect, test, type Page } from "@playwright/test";

// The whole preorder, end to end: browse and add to cart as a guest, sign up at checkout (the cart survives), place the
// order, land on the pay page, the admin verifies the payment, and the customer sees it verified.
// Runs against the in-memory demo store, where the admin password is "admin".

const stamp = Date.now();
const email = `e2e.${stamp}@example.com`;
const password = "correct horse battery";

async function checkout(page: Page) {
  await page.getByLabel("Hostel").fill("Hostel 4");
  await page.getByLabel("Room").fill("112");
  await page.locator("label", { hasText: "I confirmed the name spelling" }).click({ position: { x: 12, y: 12 } });
  await page.locator("label", { hasText: /read the/ }).click({ position: { x: 12, y: 12 } });
  await page.getByRole("button", { name: /Place order/i }).click();
}

test("preorder → pay → admin verifies → the customer sees it verified", async ({ page, browser }) => {
  // 1. A guest builds a cart.
  await page.goto("/shop");
  await page.getByRole("link", { name: /Midnight Flame Hoodie/ }).first().click();
  await expect(page).toHaveURL(/\/shop\/midnight-flame/);
  await page.locator("label.chip", { hasText: /^M$/ }).click();
  await page.getByLabel(/Name on the back/i).fill("zed tester");
  await page.getByRole("button", { name: /Add to cart/ }).click();
  await expect(page.getByRole("button", { name: /Open cart, 1 items/ })).toBeVisible();

  // 2. The cart drawer leads to checkout, which asks for an account; signing up keeps the cart.
  await page.getByRole("button", { name: /Open cart/ }).click();
  await page.getByRole("dialog").getByRole("link", { name: /checkout/i }).click();
  await expect(page).toHaveURL(/\/checkout/);
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Full name").fill("E2E Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Phone").fill(`98765 4${String(stamp).slice(-4)}`);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/checkout$/);
  await expect(page.getByText("ZED TESTER").first()).toBeVisible(); // the name on the back survived the login

  // 3. Place the order: the server re-prices it and sends us to the payment page.
  await checkout(page);
  await page.waitForURL(/\/order\/HD-[A-Z0-9]{4}\/pay/);
  const code = page.url().match(/HD-[A-Z0-9]{4}/)![0];
  await expect(page.getByRole("heading", { name: code })).toBeVisible();
  await expect(page.getByAltText(/UPI QR code for ₹999/)).toBeVisible();
  await expect(page.getByText(/Scan the QR with any UPI app/)).toBeVisible(); // desktop: the upi:// button is for phones
  await page.getByLabel(/UTR/i).fill("412345678901");
  await page.getByRole("button", { name: "Save UTR" }).click();
  await expect(page.getByText(/Got it/)).toBeVisible();

  // Pending until someone checks the money.
  await page.goto("/orders");
  const card = page.locator("article", { hasText: code });
  await expect(card.locator('ol[aria-label="Order progress"] li[aria-current="step"]')).toContainText("Placed");

  // 4. The admin verifies the payment, in a separate browser session.
  const adminCtx = await browser.newContext({ baseURL: process.env.BASE_URL ?? "http://localhost:3000", reducedMotion: "reduce" });
  const admin = await adminCtx.newPage();
  await admin.goto("/admin");
  await admin.waitForURL(/\/admin\/login/);
  await admin.getByLabel("Admin password").fill(process.env.ADMIN_PASSWORD ?? "admin");
  await admin.getByRole("button", { name: "Log in" }).click();
  await admin.waitForURL(/\/admin$/);
  await admin.locator("nav[aria-label=Admin]").getByRole("link", { name: /^Orders/ }).click();
  await admin.locator("tbody tr").filter({ hasText: code }).click();
  const drawer = admin.getByRole("dialog", { name: `Order ${code}` });
  await expect(drawer).toContainText("412345678901");
  await drawer.getByRole("button", { name: "Verify payment" }).click();
  await expect(admin.locator('[role="status"]').filter({ hasText: "Payment verified" }).first()).toBeVisible();
  await adminCtx.close();

  // 5. The customer's tracking page now shows it verified.
  await page.goto("/orders");
  await expect(card.locator('ol[aria-label="Order progress"] li[aria-current="step"]')).toContainText("Payment verified");
});

test("checkout is closed to guests, and the admin panel to everyone without the password", async ({ page, request }) => {
  await page.goto("/checkout");
  await expect(page.getByRole("tab", { name: "Create account" })).toBeVisible();
  const admin = await request.get("/admin/orders", { maxRedirects: 0 });
  expect(admin.status()).toBeGreaterThanOrEqual(300);
  expect(admin.status()).toBeLessThan(400);

  // Pages that need an account redirect before anything renders (no skeleton flash), and remember where to come back to.
  const orders = await request.get("/orders", { maxRedirects: 0 });
  expect(orders.status()).toBe(307);
  expect(orders.headers()["location"]).toContain("/login?next=%2Forders");
});

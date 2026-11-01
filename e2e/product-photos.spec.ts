import { expect, test } from "@playwright/test";
import sharp from "sharp";

// The admin adds a photo to a product, the shop card shows it (with no 3D canvas behind it), and removing it brings the
// studio picture back. Runs against the in-memory demo store, where the admin password is "admin".

test("admin photos fill the shop cards instead of the 3D model, and removing them restores the studio picture", async ({ page }) => {
  const photo = await sharp({ create: { width: 1200, height: 1500, channels: 3, background: "#2a6f4f" } }).jpeg().toBuffer();

  // 1. The admin adds a photo to a product.
  await page.goto("/admin");
  await page.waitForURL(/\/admin\/login/);
  await page.getByLabel("Admin password").fill(process.env.ADMIN_PASSWORD ?? "admin");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/admin$/);
  await page.goto("/admin/products");
  await page.getByRole("link", { name: "IIT Bombay Hoodie" }).first().click();
  await page.waitForURL(/\/admin\/products\/[0-9a-f-]{36}$/);
  const editUrl = page.url();

  const panel = page.getByRole("region", { name: "Photos" });
  await expect(panel).toContainText("0 of 8");
  await panel.locator('input[type="file"]').setInputFiles({ name: "front.jpg", mimeType: "image/jpeg", buffer: photo });
  await expect(panel).toContainText("1 of 8");
  await expect(panel.getByRole("img", { name: "Photo 1 (cover)" })).toBeVisible();

  // 2. The shop card shows it, and nothing 3D loads when the card is hovered.
  await page.goto("/shop");
  const card = page.locator('a[href="/shop/iit-bombay-hoodie"]');
  await expect(card.locator("img").first()).toHaveAttribute("src", /photos/);
  await card.hover();
  await page.waitForTimeout(800);
  await expect(page.locator("canvas")).toHaveCount(0);

  // 3. Something that isn't a picture is refused with a message, and nothing is stored.
  await page.goto(editUrl);
  await panel.locator('input[type="file"]').setInputFiles({ name: "notes.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not really a picture") });
  await expect(page.locator('[role="status"]').filter({ hasText: "isn't a photo we can read" }).first()).toBeVisible();
  await expect(panel).toContainText("1 of 8");

  // 4. Removing the photo (two taps) puts the studio picture back on the card.
  await panel.getByRole("button", { name: "Remove" }).click();
  await panel.getByRole("button", { name: "Tap again to remove" }).click();
  await expect(panel).toContainText("0 of 8");
  await page.goto("/shop");
  const src = await card.locator("img").first().getAttribute("src");
  expect(src).toMatch(/products/);
  expect(src).not.toMatch(/photos/);
});

test("the product admin pages need the password, and a photo that doesn't exist is a plain 404", async ({ request }) => {
  const products = await request.get("/admin/products", { maxRedirects: 0 });
  expect(products.status()).toBeGreaterThanOrEqual(300);
  expect(products.status()).toBeLessThan(400);
  expect((await request.get("/photos/00000000-0000-4000-8000-0000000000ff")).status()).toBe(404);
});

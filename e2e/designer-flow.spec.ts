import { expect, test, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";

// A designer's whole life, end to end: apply, get approved at 6%, upload a design, go through a change request, get it
// published, sell a piece, and see ₹23 of commission (and nothing about the buyer). Runs against the in-memory demo
// store, where the admin password is "admin".

const stamp = Date.now();
const base = process.env.BASE_URL ?? "http://localhost:3000";
const password = "correct horse battery";
const designerName = `Dia Designer ${String(stamp).slice(-4)}`;
const designerEmail = `designer.${stamp}@example.com`;
const title = `Lakeside Dusk ${String(stamp).slice(-4)}`;

const phone = (n: number) => `98765 4${String(stamp + n).slice(-4)}`;
const art = (colour: string) => sharp({ create: { width: 1000, height: 1250, channels: 3, background: colour } }).jpeg().toBuffer();

async function signUpDesigner(page: Page, name: string, email: string, n: number) {
  await page.goto("/designers");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Phone").fill(phone(n));
  await page.locator("label", { hasText: /designer terms/ }).click({ position: { x: 12, y: 12 } });
  await page.getByRole("button", { name: "Create designer account" }).click();
  await page.waitForURL(/\/designer$/);
}

async function adminPage(browser: Browser) {
  const ctx = await browser.newContext({ baseURL: base, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/admin");
  await page.waitForURL(/\/admin\/login/);
  await page.getByLabel("Admin password").fill(process.env.ADMIN_PASSWORD ?? "admin");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/admin$/);
  return { ctx, page };
}

const toast = (page: Page, text: string | RegExp) => page.locator('[role="status"]').filter({ hasText: text }).first();

test("designer: apply → approved → design reviewed and published → a sale earns commission → payout", async ({ page, browser }) => {
  // 1. Anyone can apply; until approved there is nothing to do but wait.
  await signUpDesigner(page, designerName, designerEmail, 1);
  await expect(page.getByRole("heading", { name: "Application received" })).toBeVisible();
  await page.goto("/designer/designs/new");
  await expect(page).toHaveURL(/\/designer$/); // upload is closed until approval

  // 2. The admin approves them at 6%.
  const { ctx: adminCtx, page: admin } = await adminPage(browser);
  await admin.goto("/admin/designers");
  await admin.getByRole("link", { name: designerName }).first().click();
  await admin.waitForURL(/\/admin\/designers\/[0-9a-f-]{36}$/);
  const designerUrl = admin.url();
  await admin.getByLabel(/Commission \(% of profit\)/).fill("11");
  await admin.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(admin.getByRole("alert").filter({ hasText: "from 4 to 10" }).first()).toBeVisible(); // 11% is refused
  await admin.getByLabel(/Commission \(% of profit\)/).fill("6");
  await admin.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(toast(admin, /approved/i)).toBeVisible();

  // 3. The dashboard unlocks and shows the rate; the designer creates a design.
  await page.goto("/designer");
  await expect(page.getByRole("heading", { name: /^Hi, Dia/ })).toBeVisible();
  await expect(page.getByText("6%", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "New design" }).first().click();
  await page.waitForURL(/\/designer\/designs\/new$/);
  await page.getByLabel("Title").fill(title);
  await page.locator("label.chip", { hasText: "Hoodie" }).click();
  await page.locator("label.chip", { hasText: "Black" }).click();
  await page.getByLabel(/Description/).fill("Dusk over Powai lake, screen printed in two inks.");
  await page.getByLabel(/Price you suggest/).fill("899");
  await page.locator("label", { hasText: /my own work/ }).click({ position: { x: 12, y: 12 } });
  await page.getByRole("button", { name: "Create design and add images" }).click();
  await page.waitForURL(/\/designer\/designs\/[0-9a-f-]{36}/);
  const designUrl = new URL(page.url()).pathname;

  // Can't be sent without images, and the page says why.
  await expect(page.getByRole("button", { name: "Send for review" })).toBeDisabled();
  await expect(page.getByText("Upload at least one image.")).toBeVisible();

  await page.getByTestId("design-image-input").setInputFiles([
    { name: "front.jpg", mimeType: "image/jpeg", buffer: await art("#1c3a5e") },
    { name: "back.jpg", mimeType: "image/jpeg", buffer: await art("#a63d2f") },
  ]);
  await expect(page.getByRole("img", { name: "Design image 2" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Design image 1 (cover)" })).toBeVisible();
  await page.getByRole("button", { name: "Send for review" }).click();
  await expect(page.getByText(/team is looking at it/i)).toBeVisible();

  // Privacy of the images: only the owner and the admin can load them.
  const imageUrl = (await page.getByRole("img", { name: "Design image 1 (cover)" }).getAttribute("src"))!;
  const imagePath = new URL(imageUrl, base).pathname;
  expect(imagePath).toMatch(/^\/design-images\/[0-9a-f-]{36}$/);
  const adminImagePath = imagePath.replace("/design-images/", "/admin/design-images/");
  expect((await page.request.get(imagePath)).status()).toBe(200);
  expect((await page.request.get(adminImagePath, { maxRedirects: 0 })).status()).toBe(307); // the designer can't use the admin copy
  expect((await admin.request.get(adminImagePath)).status()).toBe(200); // the admin cookie only reaches /admin, hence the copy
  const stranger = await browser.newContext({ baseURL: base, reducedMotion: "reduce" });
  expect((await stranger.request.get(imagePath)).status()).toBe(404);
  const otherPage = await stranger.newPage();
  await signUpDesigner(otherPage, `Other Designer ${String(stamp).slice(-4)}`, `other.${stamp}@example.com`, 2);
  expect((await stranger.request.get(imagePath)).status()).toBe(404); // another logged-in designer can't see it either
  expect((await stranger.request.get(adminImagePath, { maxRedirects: 0 })).status()).toBe(307);
  await otherPage.goto(designUrl); // not approved yet, so they can't open any design page, least of all this one
  await expect(otherPage).toHaveURL(/\/designer$/);
  await expect(otherPage.locator("main")).not.toContainText(title);
  await stranger.close();

  // 4. The admin asks for changes (a note is required); the designer fixes and resends; the admin approves.
  await admin.goto("/admin/designs?status=in_review");
  await admin.getByRole("link", { name: new RegExp(title) }).first().click();
  await admin.waitForURL(/\/admin\/designs\/[0-9a-f-]{36}$/);
  const reviewUrl = admin.url();
  for (const n of [1, 2]) await expect(admin.getByRole("img", { name: `Design image ${n}` })).toHaveJSProperty("complete", true); // both load for the admin
  expect(await admin.getByRole("img", { name: "Design image 1" }).evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await admin.getByRole("button", { name: "Request changes" }).click();
  await expect(admin.getByRole("alert").filter({ hasText: "Say what needs to change" }).first()).toBeVisible();
  await admin.getByLabel("Note to the designer").fill("Please add a flat back view.");
  await admin.getByRole("button", { name: "Request changes" }).click();
  await expect(toast(admin, /sent back|changes/i)).toBeVisible();

  await page.goto(designUrl);
  await expect(page.getByText("Please add a flat back view.")).toBeVisible();
  await page.getByLabel("Title").fill(`${title} v2`);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: `${title} v2` })).toBeVisible();
  await page.getByRole("button", { name: "Send back for review" }).click();
  await expect(page.getByText(/team is looking at it/i)).toBeVisible();

  await admin.goto(reviewUrl);
  await admin.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(toast(admin, /approved/i)).toBeVisible();

  // 5. Publish it: price 899, cost 500, so profit ₹399 and 6% of that is ₹23 (rounded down) a piece.
  await admin.reload();
  await admin.getByLabel("Selling price (₹)").fill("899");
  await admin.getByLabel(/Cost to make/).fill("500");
  await expect(admin.getByRole("status").filter({ hasText: /earns/ })).toContainText("₹23");
  const slug = await admin.getByLabel("Web address (slug)").inputValue(); // read before the form goes away
  await admin.getByRole("button", { name: "Put it live" }).click();
  await expect(toast(admin, /live/i)).toBeVisible();
  await admin.goto(reviewUrl);
  await expect(admin.getByRole("heading", { name: "Live in the shop" })).toBeVisible();

  // The designer's side shows it live, and the product is in the shop with the designer's first image as its photo.
  await page.goto(designUrl);
  await expect(page.getByText("Live in the store.")).toBeVisible();
  await page.goto("/shop");
  const card = page.getByRole("link", { name: new RegExp(`${title} v2`) }).first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(/\/shop\/.+/);
  const productUrl = new URL(page.url()).pathname;
  expect(productUrl).toBe(`/shop/${slug}`);

  // 6. A customer buys one; until the money is checked it is "waiting", not earned.
  const buyerCtx = await browser.newContext({ baseURL: base, reducedMotion: "reduce" });
  const buyer = await buyerCtx.newPage();
  await buyer.goto(productUrl);
  await buyer.locator("label.chip", { hasText: /^M$/ }).click();
  await buyer.getByRole("button", { name: /Add to cart/ }).click();
  await expect(buyer.getByRole("button", { name: /Open cart, 1 items/ })).toBeVisible();
  await buyer.getByRole("button", { name: /Open cart/ }).click();
  await buyer.getByRole("dialog").getByRole("link", { name: /checkout/i }).click();
  await buyer.getByRole("tab", { name: "Create account" }).click();
  await buyer.getByLabel("Full name").fill("Bo Buyer");
  await buyer.getByLabel("Email").fill(`buyer.${stamp}@example.com`);
  await buyer.getByLabel("Password", { exact: true }).fill(password);
  await buyer.getByLabel("Phone").fill(phone(3));
  await buyer.getByRole("button", { name: "Create account" }).click();
  await buyer.waitForURL(/\/checkout$/);
  await buyer.getByLabel("Your hostel").fill("Hostel 9");
  await buyer.getByLabel("Your room number").fill("101");
  await buyer.locator("label", { hasText: "I confirmed the name spelling" }).click({ position: { x: 12, y: 12 } });
  await buyer.locator("label", { hasText: /read the/ }).click({ position: { x: 12, y: 12 } });
  await buyer.getByRole("button", { name: /Place order/i }).click();
  await buyer.waitForURL(/\/order\/HD-[A-Z0-9]{4}\/pay/);
  const code = buyer.url().match(/HD-[A-Z0-9]{4}/)![0];

  await page.goto("/designer");
  await expect(page.getByText(/1 piece is waiting/)).toBeVisible();
  await page.goto("/designer/earnings");
  await expect(page.getByRole("cell", { name: "Awaiting payment" })).toBeVisible();

  // 7. The admin verifies the payment; now it counts: 1 piece, ₹23.
  await admin.goto("/admin/orders");
  await admin.locator("tbody tr").filter({ hasText: code }).click();
  await admin.getByRole("dialog", { name: `Order ${code}` }).getByRole("button", { name: "Verify payment" }).click();
  await expect(toast(admin, "Payment verified")).toBeVisible();

  await page.goto("/designer");
  const stat = (label: string) => page.locator("div", { has: page.getByText(label, { exact: true }) }).last();
  await expect(stat("Pieces sold")).toContainText("1");
  await expect(stat("Commission earned")).toContainText("₹23");
  await expect(stat("Your commission")).toContainText("6%");
  await page.goto("/designer/earnings");
  await expect(page.getByRole("cell", { name: "Counted" })).toBeVisible();

  // The designer's pages never show who bought it, where it goes, or what the order is called.
  const texts: string[] = [];
  for (const path of ["/designer/earnings", "/designer", "/designer/designs"]) {
    await page.goto(path);
    texts.push(await page.locator("main").innerText());
  }
  const seen = texts.join("\n");
  for (const secret of ["Bo Buyer", `buyer.${stamp}@example.com`, "Hostel 9", code, phone(3), "₹500", "Cost to make"]) expect(seen).not.toContain(secret);

  // 8. A payout above what is owed is refused; the exact balance is recorded and the balance drops to zero.
  await admin.goto(designerUrl);
  await expect(admin.getByText(/Balance\s*₹23/)).toBeVisible();
  await admin.getByLabel("Amount sent (₹)").fill("50");
  await admin.getByRole("button", { name: "Record payout" }).click();
  await expect(admin.getByRole("alert").filter({ hasText: /more than|balance|owed/i }).first()).toBeVisible();
  await admin.getByLabel("Amount sent (₹)").fill("23");
  await admin.getByLabel("UTR / reference").fill("UTR-E2E-0001");
  await admin.getByRole("button", { name: "Record payout" }).click();
  await expect(toast(admin, /payout/i)).toBeVisible();

  await page.goto("/designer/earnings");
  await expect(page.getByText("UTR-E2E-0001")).toBeVisible();
  await expect(stat("Still to be paid")).toContainText("₹0");

  // 9. Suspending the designer closes upload but leaves what they've already earned on their dashboard.
  await admin.goto(designerUrl);
  await admin.getByRole("button", { name: "Suspend" }).click();
  await expect(toast(admin, /suspend|paused/i)).toBeVisible();
  await page.goto("/designer/designs/new");
  await expect(page).toHaveURL(/\/designer$/);
  await expect(page.getByRole("heading", { name: /paused/i })).toBeVisible();

  await buyerCtx.close();
  await adminCtx.close();
});

test("the designer area is closed to guests and to customers who haven't applied", async ({ page, request }) => {
  const guest = await request.get("/designer", { maxRedirects: 0 });
  expect(guest.status()).toBe(307);
  expect(guest.headers()["location"]).toContain("/login?next=%2Fdesigner");
  expect((await request.get("/designer/earnings", { maxRedirects: 0 })).status()).toBe(307);
  expect((await request.get("/design-images/00000000-0000-4000-8000-000000000000")).status()).toBe(404);

  // A plain customer is sent to the application page, not to a dashboard.
  await page.goto("/login?next=%2Fdesigner");
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Full name").fill("Plain Customer");
  await page.getByLabel("Email").fill(`plain.${stamp}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Phone").fill(phone(4));
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/designers$/);
  await expect(page.getByRole("heading", { name: /Sell your\s*design/i })).toBeVisible();
});

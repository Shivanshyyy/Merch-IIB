// Phase 4 in a real (software-WebGL) browser: marquee, headline reveals, cursor, page wipe, add-to-cart flight, shop
// turntable, home preloader, reduced motion, and layout shift on every page.
//   npm run with-server -- node scripts/polish.mjs --out=<dir> [--only=shop|home|reduced|cls]
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = arg("out", "scripts/.out/shots-polish");
const ONLY = arg("only", "");
const VP = arg("vp", ""); // cls: phone | desktop
const PAGES = arg("pages", ""); // cls: comma-separated public paths to check; skips the logged-in flow
mkdirSync(OUT, { recursive: true });

const GL = ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const watch = (page, label) => {
  page.on("pageerror", (e) => problems.push(`[${label}] pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/404|Failed to load resource/.test(m.text()) && problems.push(`[${label}] console: ${m.text()}`));
};
const until = async (fn, ms, what) => {
  for (const t0 = Date.now(); Date.now() - t0 < ms; ) {
    const v = await fn();
    if (v) return v;
    await sleep(100);
  }
  throw new Error(`timed out waiting for ${what}`);
};
const run = (name) => !ONLY || ONLY === name;
// A word at rest reads "none", or the identity matrix once an animation has filled forwards.
const atRest = (t) => t === "none" || t === "matrix(1, 0, 0, 1, 0, 0)";

const browser = await chromium.launch({ args: GL });
try {
  // ---------------------------------------------------------------- the shop: strip, reveals, cursor, wipe, turntable, flight
  if (run("shop")) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    watch(page, "shop");
    await page.goto(`${BASE}/shop`);

    // marquee: the spec sentence, with a live countdown, inside the fixed header
    const strip = page.getByRole("region", { name: "Preorder status" });
    const sentence = await until(async () => {
      const t = (await strip.locator(".sr-only").textContent()) ?? "";
      return t.includes("--D") ? null : t;
    }, 10000, "the countdown to start");
    assert.match(sentence, /^PREORDER BATCH 01\. CLOSES IN \d\dD \d\dH \d\dM\. PICKUP AT HOSTEL 4\.$/);
    const header = await page.locator("header").boundingBox();
    assert.ok(header.height > 80 && header.height < 92, `strip + nav bar (${header.height}px)`);
    const h1 = await page.locator("h1").boundingBox();
    assert.ok(h1.y >= header.height, "the title starts below the header");
    const moving = await page.locator(".marquee-track").evaluate((el) => getComputedStyle(el).animationName);
    assert.equal(moving, "marquee", "the strip moves");

    // headline reveal: words slide up out of masks, then rest in place
    const words = page.locator("h1 .rv-i");
    assert.ok((await words.count()) >= 3, "the headline is split into words");
    await sleep(1800);
    for (const t of await words.evaluateAll((els) => els.map((e) => getComputedStyle(e).transform))) assert.ok(atRest(t), `every word has settled (${t})`);
    await page.screenshot({ path: `${OUT}/shop-01-strip-reveal.png` });

    // cursor: dot -> VIEW ring over a card, hidden over a text field, DRAG elsewhere is checked on the home page
    await page.mouse.move(400, 600);
    await until(() => page.evaluate(() => document.documentElement.classList.contains("has-cursor")), 3000, "the custom cursor");
    const card = await page.locator('a[data-cursor="view"]').first().boundingBox();
    await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2, { steps: 6 });
    await until(() => page.locator('.cursor[data-kind="view"]').count(), 3000, "the VIEW ring");
    assert.equal((await page.locator(".cursor-ring-i").textContent())?.trim(), "VIEW");

    // turntable: hover hands the picture to the live model, leaving hands it back
    const stage = await page.locator("[data-turntable-stage]").first().boundingBox();
    await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2, { steps: 4 });
    await page.locator('.turntable-box[data-on="true"]').waitFor({ timeout: 120000 });
    assert.equal(await page.locator('a[data-tt="ready"]').count(), 1, "the hovered card swaps its still for the live view");
    const box = await page.locator(".turntable-box").boundingBox();
    assert.ok(Math.abs(box.width - stage.width) < 2 && Math.abs(box.x - stage.x) < 2, "the canvas sits exactly on the card's picture");
    await sleep(2500);
    await page.screenshot({ path: `${OUT}/shop-02-turntable.png` });
    const spin = async () => page.evaluate(() => document.querySelector(".turntable-box canvas").toDataURL("image/png").length);
    await page.mouse.move(40, 500, { steps: 6 });
    await page.locator('.turntable-box[data-on="false"]').waitFor({ timeout: 5000 });
    assert.equal(await page.locator('a[data-tt="ready"]').count(), 0, "moving away restores the still");
    void spin;

    // page wipe: a click on an in-app link covers, navigates, lifts
    await page.locator('footer a[href="/policies"]').click();
    await page.locator(".wipe").waitFor({ timeout: 3000 });
    assert.equal((await page.locator(".wipe-label").textContent())?.trim(), "Policies", "the wipe names the page it is opening");
    await page.screenshot({ path: `${OUT}/shop-03-wipe.png` });
    await page.waitForURL("**/policies", { timeout: 15000 });
    await page.locator(".wipe").waitFor({ state: "detached", timeout: 8000 });
    await page.goBack();
    await page.waitForURL("**/shop");
    await sleep(500);
    assert.equal(await page.locator(".wipe").count(), 0, "back/forward leave the wipe out");

    // product page: the primary button leans toward the pointer; the picture flies to the cart
    await page.goto(`${BASE}/shop/ash`);
    await page.locator("label.chip", { hasText: /^M$/ }).click();
    const add = page.getByRole("button", { name: /Add to cart/ });
    const b = await add.boundingBox();
    await page.mouse.move(b.x + b.width - 6, b.y + b.height / 2, { steps: 8 });
    await until(() => add.evaluate((el) => el.style.translate !== ""), 3000, "the button to lean");
    const lean = await add.evaluate((el) => el.style.translate);
    assert.match(lean, /^-?[\d.]+px( -?[\d.]+px)?$/, "the button leans a few pixels toward the pointer (a zero y offset serialises as one value)");
    await page.mouse.move(b.x + b.width / 2, b.y - 120, { steps: 6 });
    await until(() => add.evaluate((el) => el.style.translate === ""), 3000, "the button to settle");
    const name = await page.getByLabel(/Name on the back/i).boundingBox();
    await page.mouse.move(name.x + 30, name.y + name.height / 2, { steps: 6 });
    await until(() => page.locator('.cursor[data-hidden="true"]').count(), 3000, "the cursor to hide over a text field");

    const badge = page.getByRole("button", { name: /Open cart/ });
    assert.match((await badge.getAttribute("aria-label")) ?? "", /0 items/);
    await add.click();
    await until(() => page.locator("[data-fly]").count(), 2000, "the thumbnail to take off");
    assert.match((await badge.getAttribute("aria-label")) ?? "", /0 items/, "the badge doesn't count it until it lands");
    await page.screenshot({ path: `${OUT}/product-01-flight.png` });
    await until(() => badge.getAttribute("aria-label").then((l) => /1 items/.test(l ?? "")), 4000, "the thumbnail to land");
    await until(async () => (await page.locator("[data-fly]").count()) === 0, 3000, "the thumbnail to be gone");
    await ctx.close();
  }

  // ---------------------------------------------------------------- the home preloader
  if (run("home")) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const html = await (await ctx.request.get(`${BASE}/`)).text();
    assert.ok(/class="preloader"/.test(html) && /data-state="pending"/.test(html), "the preloader is in the server HTML, so it is the first thing painted");
    assert.ok(html.includes("merch-boot") && html.includes("classList.add('js')"), "the boot script runs before first paint");

    const page = await ctx.newPage();
    watch(page, "home");
    await page.goto(`${BASE}/`);
    const seen = [];
    let sawLeaving = false;
    let shotMid = false;
    for (const t0 = Date.now(); Date.now() - t0 < 120000; ) {
      const state = await page.evaluate(() => {
        const el = document.querySelector(".preloader");
        if (!el) return null;
        return { text: el.querySelector(".preloader-count")?.textContent, state: el.getAttribute("data-state") };
      });
      if (!state) break;
      if (state.text) seen.push(Number(state.text));
      if (!shotMid && seen.at(-1) > 25 && state.state === "pending") {
        shotMid = true;
        await page.screenshot({ path: `${OUT}/home-01-preloader.png` });
      }
      if (state.state === "leaving" && !sawLeaving) {
        sawLeaving = true;
        await page.screenshot({ path: `${OUT}/home-02-split.png` });
      }
      await sleep(80);
    }
    assert.ok(seen.length > 5, `the counter was visible (${seen.length} samples)`);
    assert.ok(seen.every((v, i) => i === 0 || v >= seen[i - 1]), "the counter never goes backwards");
    assert.equal(seen.at(-1), 100, "and ends on 100");
    assert.ok(seen[0] < 30, `it starts near zero (${seen[0]})`);
    assert.ok(sawLeaving, "then splits apart");
    assert.equal(await page.locator(".preloader").count(), 0, "and is gone");
    assert.ok(await page.evaluate(() => document.documentElement.classList.contains("booted") && sessionStorage.getItem("merch-boot") === "1"), "it remembers it has played");
    await sleep(1500);
    assert.ok(await page.locator("h1[data-in]").count(), "the hero headline reveals once the preloader has gone");
    await page.screenshot({ path: `${OUT}/home-03-after.png` });

    // the cursor over the 3D scene says DRAG
    await page.mouse.move(900, 460);
    await page.mouse.move(930, 470, { steps: 4 });
    await until(() => page.locator('.cursor[data-kind="drag"]').count(), 3000, "the DRAG ring over the scene");
    assert.equal((await page.locator(".cursor-ring-i").textContent())?.trim(), "DRAG");
    await page.screenshot({ path: `${OUT}/home-04-drag-cursor.png` });

    // second visit in the same session: nothing to wait for
    await page.reload();
    await sleep(300);
    assert.equal(await page.locator(".preloader:visible").count(), 0, "a repeat visit skips the preloader");
    await ctx.close();
  }

  // ---------------------------------------------------------------- reduced motion keeps everything still
  if (run("reduced")) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    watch(page, "reduced");
    await page.goto(`${BASE}/`);
    await sleep(800);
    assert.equal(await page.locator(".preloader:visible").count(), 0, "no preloader");
    assert.equal(await page.locator("canvas").count(), 0, "no 3D");
    assert.equal(await page.locator(".marquee-track").evaluate((el) => getComputedStyle(el).animationName), "none", "a still strip");
    for (const t of await page.locator("h1 .rv-i").evaluateAll((els) => els.map((e) => getComputedStyle(e).transform))) assert.ok(atRest(t), `headlines are simply there (${t})`);
    await page.mouse.move(500, 500);
    await sleep(300);
    assert.ok(!(await page.evaluate(() => document.documentElement.classList.contains("has-cursor"))), "the normal cursor stays");
    await page.locator('footer a[href="/shop"]').click();
    await page.waitForURL("**/shop", { timeout: 15000 });
    assert.equal(await page.locator(".wipe").count(), 0, "navigation without the wipe");
    const stage = await page.locator("[data-turntable-stage]").first().boundingBox();
    await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2, { steps: 4 });
    await sleep(800);
    assert.equal(await page.locator(".turntable-box").count(), 0, "cards keep the plain still");
    await ctx.close();
  }

  // ---------------------------------------------------------------- layout shift
  if (run("cls")) {
    const pages = ["/", "/shop", "/shop/ash", "/cart", "/policies", "/login", "/login?next=%2Forders", "/orders", "/nope"];
    for (const [label, viewport, o] of [
      ["phone", { width: 390, height: 844 }, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 }],
      ["desktop", { width: 1440, height: 900 }, {}],
    ]) {
      if (VP && VP !== label) continue;
      const ctx = await browser.newContext({ viewport, ...o });
      await ctx.addInitScript(() => {
        window.__cls = 0;
        window.__shifts = [];
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (e.hadRecentInput) continue;
            window.__cls += e.value;
            const r = (q) => [q.x, q.y, q.width, q.height].map(Math.round).join(",");
            window.__shifts.push(`${e.value.toFixed(4)} @${Math.round(e.startTime)}ms ${(e.sources ?? []).map((x) => `${x.node?.nodeName}.${String(x.node?.className ?? "").slice(0, 30)} [${r(x.previousRect)}] -> [${r(x.currentRect)}]`).join("; ")}`);
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      const page = await ctx.newPage();
      watch(page, `cls ${label}`);
      for (const path of pages) {
        if (PAGES && !PAGES.split(",").includes(path)) continue;
        await page.goto(`${BASE}${path}`);
        await page.waitForLoadState("networkidle");
        await sleep(label === "phone" && path === "/" ? 6000 : 2500);
        const cls = await page.evaluate(() => window.__cls);
        console.log(`[cls ${label}] ${path.padEnd(10)} ${cls.toFixed(4)}`);
        if (cls >= 0.003) console.log((await page.evaluate(() => window.__shifts)).join("\n"));
        assert.ok(cls < 0.01, `layout shift on ${path} (${label}): ${cls}`);
      }

      if (PAGES) {
        await ctx.close();
        continue;
      }
      // The logged-in pages: sign up with something in the cart, then measure each, and the pay page of a real order.
      const measure = async (path) => {
        await page.goto(`${BASE}${path}`);
        await page.waitForLoadState("networkidle");
        await sleep(2500);
        const cls = await page.evaluate(() => window.__cls);
        console.log(`[cls ${label}] ${path.replace(/HD-\w+/, "HD-xxxx").padEnd(24)} ${cls.toFixed(4)}`);
        assert.ok(cls < 0.01, `layout shift on ${path} (${label}): ${cls}`);
      };
      await page.goto(`${BASE}/shop/ash`);
      await page.locator("label.chip", { hasText: /^M$/ }).click();
      await page.getByLabel(/Name on the back/i).fill("cls check");
      await page.getByRole("button", { name: /Add to cart/ }).click();
      await page.goto(`${BASE}/checkout`);
      await page.getByRole("tab", { name: "Create account" }).click();
      await page.getByLabel("Full name").fill("Cls Check");
      await page.getByLabel("Email").fill(`cls.${label}.${Date.now()}@example.com`);
      await page.getByLabel("Password", { exact: true }).fill("correct horse battery");
      await page.getByLabel("Phone").fill("9876543210");
      await page.getByRole("button", { name: "Create account" }).click();
      await page.getByLabel("Hostel").waitFor(); // the form only appears once the account exists (the URL doesn't change)
      for (const path of ["/checkout", "/account", "/orders"]) await measure(path);
      await page.goto(`${BASE}/checkout`);
      await page.getByLabel("Hostel").fill("Hostel 4");
      await page.getByLabel("Room").fill("112");
      await page.locator("label", { hasText: "I confirmed the name spelling" }).click({ position: { x: 12, y: 12 } });
      await page.locator("label", { hasText: /read the/ }).click({ position: { x: 12, y: 12 } });
      await page.getByRole("button", { name: /Place order/i }).click();
      await page.waitForURL(/\/order\/HD-[A-Z0-9]{4}\/pay/, { timeout: 15000 });
      const pay = new URL(page.url()).pathname;
      await measure(pay);
      await measure("/orders");
      await ctx.close();
    }
  }

  assert.deepEqual(problems, [], "no page errors or console errors");
  console.log("polish walkthrough passed");
} finally {
  await browser.close();
}

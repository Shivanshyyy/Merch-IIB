// Share-preview images and app icons, regenerated from the real site and the studio stills:
//   public/og.jpg            the home hero (headline + the live 3D hoodie), 1200x630
//   public/og/<slug>.jpg     one per product, the first colourway on the brand's red glow
//   public/icon-192.png, public/icon-512.png, src/app/apple-icon.png   from src/app/icon.svg
//   npm run with-server -- node scripts/make-og.mjs
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import sharp from "sharp";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---- icons
const svg = readFileSync("src/app/icon.svg");
for (const [file, size] of [["public/icon-192.png", 192], ["public/icon-512.png", 512], ["src/app/apple-icon.png", 180]]) {
  await sharp(svg, { density: 600 }).resize(size, size).png().toFile(file);
  console.log(file);
}

// ---- per-product previews
mkdirSync("public/og", { recursive: true });
const glow = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><radialGradient id="g" cx="50%" cy="58%" r="55%"><stop offset="0" stop-color="#ff3b1f" stop-opacity=".42"/><stop offset="1" stop-color="#ff3b1f" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="630" fill="#0a0a0b"/><rect width="1200" height="630" fill="url(#g)"/></svg>`,
);
const seed = JSON.parse(readFileSync("supabase/seed.json", "utf8"));
for (const p of seed.products) {
  const still = `public/products/${p.slug}-${slug(p.colorways[0].name)}-front.webp`;
  const hoodie = await sharp(still).resize({ height: 580, fit: "inside" }).png().toBuffer();
  await sharp(glow).composite([{ input: hoodie, gravity: "centre" }]).jpeg({ quality: 86, mozjpeg: true }).toFile(`public/og/${p.slug}.jpg`);
  console.log(`public/og/${p.slug}.jpg`);
}

// ---- the home hero, from the live page
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => sessionStorage.setItem("merch-boot", "1")); // skip the preloader
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?debug`);
  await page.locator('[data-scene-ready="true"]').waitFor({ timeout: 120000 });
  // A 1200x630 card wants a tighter composition than a full screen: smaller headline on the left, the hoodie big on the right.
  await page.addStyleTag({
    content:
      "header, .grain, .cursor, [data-home-root] .btn, [data-home-root] p, [data-home-root] .label { display: none !important } [data-home-root] h1 { font-size: 104px !important; line-height: 0.86 !important }",
  });
  await page.evaluate(() => Object.assign(window.__homeScene.pose, { orbit: 0, az: 0.45, el: 0.1, r: 1.75, ox: 0.24, oy: 0 }));
  for (const t0 = Date.now(); Date.now() - t0 < 60000; ) {
    const n = await page.evaluate(() => window.__homeScene.gl.info.render.frame);
    await sleep(1500);
    if ((await page.evaluate(() => window.__homeScene.gl.info.render.frame)) - n >= 6) break;
  }
  await sleep(3500); // headline reveal and the poster/canvas fade
  const png = await page.screenshot();
  await sharp(png).jpeg({ quality: 88, mozjpeg: true }).toFile("public/og.jpg");
  console.log("public/og.jpg");
} finally {
  await browser.close();
}

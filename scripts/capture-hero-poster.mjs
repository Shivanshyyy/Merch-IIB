// Renders the home hero's first 3D frame on a transparent background: public/products/hero-poster.webp.
// The page shows it while the 3D loads (and when 3D can't run), and the scene fades in over it without a visible swap.
// Re-run after changing the model, camera or lights:  npm run with-server -- node scripts/capture-hero-poster.mjs
import { chromium } from "playwright";
import sharp from "sharp";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto(`${BASE}/`);
await page.getByText("Drag to turn").waitFor({ timeout: 60000 });
await page.waitForTimeout(250); // the scene holds still for 1.6 s after it appears
await page.addStyleTag({
  content: `*, *::before, *::after { background: transparent !important; background-image: none !important; box-shadow: none !important; }
    *::before, *::after { display: none !important; }
    body * { visibility: hidden !important; }
    main canvas { visibility: visible !important; }`,
});
const png = await page.locator("main canvas").first().screenshot({ omitBackground: true });
await sharp(png).webp({ quality: 82, alphaQuality: 90 }).toFile("public/products/hero-poster.webp");
console.log("wrote public/products/hero-poster.webp");
await browser.close();

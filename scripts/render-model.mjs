// Headless-WebGL renders of the hoodie GLB.
//   node scripts/render-model.mjs compare --out=<dir>   original vs optimised contact sheet + silhouette overlap
//   node scripts/render-model.mjs stills                 product stills into public/products/
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary", ".wasm": "application/wasm" };

const flag = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;

function serve() {
  const server = createServer((req, res) => {
    const path = normalize(join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname)));
    if (!path.startsWith(ROOT) || !existsSync(path) || !statSync(path).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
    createReadStream(path).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port })));
}

async function withRenderer(fn) {
  const { server, port } = await serve();
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  try {
    const page = await browser.newPage();
    page.on("console", (m) => m.type() === "error" && console.error("[page]", m.text()));
    page.on("pageerror", (e) => console.error("[pageerror]", e.message));
    await page.goto(`http://127.0.0.1:${port}/scripts/render-model.html`);
    await page.waitForFunction(() => window.ready === true, null, { timeout: 30_000 });
    const shot = async (opts) => {
      const { png, frame } = await page.evaluate((o) => window.renderShot(o), { url: `http://127.0.0.1:${port}/${opts.model}`, ...opts });
      return { buf: Buffer.from(png.split(",")[1], "base64"), frame };
    };
    return await fn(shot);
  } finally {
    await browser.close();
    server.close();
  }
}

async function compare(outDir) {
  mkdirSync(outDir, { recursive: true });
  const ORIG = "assets-raw/hoodie.glb";
  const OPT = flag("opt", "public/models/hoodie.glb");
  const SIZE = 560;
  const views = [
    { name: "front", az: 0, el: 0.1 },
    { name: "three-quarter", az: 0.8, el: 0.2 },
    { name: "side", az: 1.5708, el: 0.05 },
    { name: "back", az: 3.1416, el: 0.1 },
    { name: "cuff close-up", az: 0.4, el: 0.1, focus: "^Rib_2X2", fill: 0.9 },
    { name: "hood close-up", az: 0.5, el: 0.25, focus: "^Sweat_hood", fill: 0.9 },
    { name: "front flame close-up", az: 0, el: 0.05, offset: [-0.045, 0.025, 0], r: 0.08, fill: 0.9 },
    { name: "back flame close-up", az: 3.1416, el: 0.05, offset: [0, 0.03, 0], r: 0.12, fill: 0.9 },
  ];
  const only = new RegExp(flag("only", "."), "i");
  const look = { body: "#8a8a8c", stitch: "#c8200e" };
  const rows = [];

  await withRenderer(async (shot) => {
    for (const v of views.filter((x) => only.test(x.name))) {
      const base = { size: SIZE, az: v.az, el: v.el, focus: v.focus, fill: v.fill, offset: v.offset, r: v.r };
      const frame = (await shot({ ...base, model: ORIG, mode: "silhouette" })).frame;
      const [sA, sB, shA, shB] = await Promise.all([
        shot({ ...base, model: ORIG, mode: "silhouette", frame }),
        shot({ ...base, model: OPT, mode: "silhouette", frame }),
        shot({ ...base, model: ORIG, frame, bg: "#141416", ...look }),
        shot({ ...base, model: OPT, frame, bg: "#141416", ...look }),
      ]);
      const [a, b] = await Promise.all([sA.buf, sB.buf].map((buf) => sharp(buf).removeAlpha().raw().toBuffer()));
      const diff = Buffer.alloc(SIZE * SIZE * 3);
      let inter = 0;
      let union = 0;
      for (let i = 0; i < SIZE * SIZE; i++) {
        const inA = a[i * 3] > 127;
        const inB = b[i * 3] > 127;
        if (inA || inB) union++;
        if (inA && inB) inter++;
        const c = inA && inB ? [90, 90, 94] : inA ? [255, 59, 31] : inB ? [60, 220, 120] : [10, 10, 11];
        diff.set(c, i * 3);
      }
      const iou = inter / union;
      console.log(`${v.name.padEnd(14)} silhouette overlap (IoU) ${(iou * 100).toFixed(2)}%`);
      const diffPng = await sharp(diff, { raw: { width: SIZE, height: SIZE, channels: 3 } }).png().toBuffer();
      rows.push({ name: v.name, tiles: [shA.buf, shB.buf, diffPng] });
    }
  });

  const composites = [];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < 3; c++) composites.push({ input: rows[r].tiles[c], left: c * SIZE, top: r * SIZE });
  }
  const sheet = join(outDir, "compare.png");
  await sharp({ create: { width: SIZE * 3, height: SIZE * rows.length, channels: 3, background: "#0a0a0b" } }).composite(composites).png().toFile(sheet);
  console.log(`contact sheet: ${sheet}`);
  console.log("columns: original | optimised | silhouette diff (red = lost by optimising, green = added)");
}

const cmd = process.argv[2];
if (cmd === "compare") await compare(flag("out", "scripts/.out"));
else if (cmd === "stills") {
  const { stills } = await import("./render-stills.mjs");
  await stills({ withRenderer });
} else {
  console.error("usage: render-model.mjs compare --out=<dir> | stills");
  process.exit(1);
}

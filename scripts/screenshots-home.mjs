// The 3D home in a real (software-rendered) WebGL browser: composition per section, interaction, and the static fallbacks.
//   npm run with-server -- node scripts/screenshots-home.mjs --out=<dir> [--only=desktop|phone|fallback]
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = arg("out", "scripts/.out/shots-home");
const ONLY = arg("only", "");
mkdirSync(OUT, { recursive: true });

const GL = ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const watch = (page, label) => {
  page.on("pageerror", (e) => problems.push(`[${label}] pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/404|Failed to load resource/.test(m.text()) && problems.push(`[${label}] console: ${m.text()}`));
};

const debugState = (page) =>
  page.evaluate(() => {
    const h = window.__homeScene;
    if (!h) return null;
    const tint = h.scene.getObjectByName("hoodie")?.material.userData.tint;
    return {
      cam: h.camera.position.toArray().map((v) => +v.toFixed(3)),
      pose: { ...h.pose },
      stage: { ...h.stage },
      stitch: tint?.uEmblem.value.getHexString(),
      bodyColor: tint?.uBody.value.getHexString(),
      shot: h.store.getState().shot,
      mode: h.store.getState().mode,
    };
  });

async function scene(browser, label, viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: opts.dpr ?? 1, hasTouch: !!opts.touch, isMobile: !!opts.touch });
  await ctx.addInitScript(() => sessionStorage.setItem("merch-boot", "1")); // the preloader has its own walkthrough (polish.mjs)
  const page = await ctx.newPage();
  watch(page, label);
  const shot = async (name) => {
    await page.screenshot({ path: `${OUT}/${label}-${name}.png` });
  };
  return { ctx, page, shot };
}

// Polls the rig until it reaches a mode (or the time runs out).
const until = async (page, mode, ms) => {
  for (const t0 = Date.now(); Date.now() - t0 < ms; ) {
    if ((await debugState(page)).stage.mode === mode) return true;
    await sleep(250);
  }
  return false;
};

// Waits until the renderer has really drawn `n` more frames (software WebGL can take seconds over the first ones).
const frames = async (page, n, key = "__homeScene") => {
  const start = await page.evaluate((k) => window[k].gl.info.render.frame, key);
  for (const t0 = Date.now(); Date.now() - t0 < 60000; ) {
    if ((await page.evaluate((k) => window[k].gl.info.render.frame, key)) - start >= n) return;
    await sleep(200);
  }
  throw new Error(`renderer drew fewer than ${n} frames in 60 s`);
};

const wrapDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// Projected height/width of the hoodie's bounding box as a fraction of the viewport (an upper bound on the silhouette).
const hoodieFill = (page) =>
  page.evaluate(() => {
    const h = window.__homeScene;
    const root = h.scene.getObjectByName("hoodie").parent;
    root.updateMatrixWorld(true);
    const V = root.position.constructor;
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
    for (const m of root.children) {
      if (!m.isMesh) continue;
      m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox;
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
        const p = new V(x, y, z).applyMatrix4(m.matrixWorld).project(h.camera);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      }
    }
    return { h: (maxY - minY) / 2, w: (maxX - minX) / 2 };
  });

// Callout labels that are showing must stay on screen and off the text block of their section.
const calloutProblems = (page, shot) =>
  page.evaluate((name) => {
    const copy = document.querySelector(`[data-shot="${name}"] [data-copy]`).getBoundingClientRect();
    const out = [];
    for (const c of document.querySelectorAll(".callout.callout-on")) {
      if (c.dataset.hidden === "true") continue;
      const t = c.querySelector(".callout-text").getBoundingClientRect();
      const why = [];
      if (t.left < 0 || t.right > innerWidth) why.push("off screen");
      if (t.left < copy.right && t.right > copy.left && t.top < copy.bottom && t.bottom > copy.top) why.push("on the text");
      if (why.length) out.push(`${c.textContent}: ${why.join(", ")}`);
    }
    return out;
  }, shot);

const toSection = async (page, shot, settle = 3500) => {
  await page.evaluate((s) => document.querySelector(`[data-shot="${s}"]`).scrollIntoView({ block: "center" }), shot);
  await sleep(settle);
};

const browser = await chromium.launch({ args: GL });
try {
  for (const [label, viewport, o] of [
    ["desktop", { width: 1440, height: 900 }, { dpr: 1 }],
    ["phone", { width: 390, height: 844 }, { dpr: 2, touch: true }],
  ]) {
    if (ONLY && ONLY !== label) continue;
    const { ctx, page, shot } = await scene(browser, label, viewport, o);
    await page.goto(`${BASE}/?debug`);
    await page.getByRole("heading", { name: /Wear/ }).waitFor();
    await shot("00-poster"); // what loads first, before any 3D
    await page.locator('[data-scene-ready="true"]').waitFor({ timeout: 90000 });
    await frames(page, 8);
    await sleep(1500); // the poster and canvas cross-fade over a second
    await shot("01-hero");

    const fps = await page.evaluate(
      () =>
        new Promise((resolve) => {
          let n = 0;
          const t0 = performance.now();
          const f = () => (++n, performance.now() - t0 > 3000 ? resolve(n / 3) : requestAnimationFrame(f));
          f();
        }),
    );
    console.log(`[${label}] ${fps.toFixed(1)} fps (software WebGL: only a sanity number, not a GPU measurement)`);
    let st = await debugState(page);
    assert.equal(st.mode, "webgl");
    assert.ok(Math.abs(st.pose.orbit - 1) < 1e-6, "the hero idles in orbit");
    const fill = await hoodieFill(page);
    if (label === "desktop") assert.ok(fill.h > 0.5 && fill.h < 0.66, `the hoodie fills about 55% of the hero height (box ${fill.h.toFixed(2)})`);
    else assert.ok(fill.w > 0.5 && fill.w < 0.95, `on a phone it fills most of the width (${fill.w.toFixed(2)})`);
    const az0 = st.stage.az;
    await sleep(3000);
    assert.notEqual((await debugState(page)).stage.az, az0, "the camera auto-orbits while idle");

    // ---- sections
    await toSection(page, "fabric");
    st = await debugState(page);
    assert.equal(st.shot, "fabric");
    assert.ok(st.pose.r < 1.2 && st.pose.orbit < 0.01, `pushed in close (r=${st.pose.r})`);
    await shot("02-fabric");
    assert.deepEqual(await calloutProblems(page, "fabric"), [], "callouts stay clear of the text (fabric)");
    await toSection(page, "cuff");
    assert.ok(Math.abs((await debugState(page)).pose.ty - -0.25) < 0.05, "swung to the cuff");
    await shot("03-cuff");
    assert.deepEqual(await calloutProblems(page, "cuff"), [], "callouts stay clear of the text (cuff)");
    await toSection(page, "hood");
    assert.ok(Math.abs((await debugState(page)).pose.az - 2.3) < 0.15, "swung round to the hood");
    await shot("04-hood");
    assert.deepEqual(await calloutProblems(page, "hood"), [], "callouts stay clear of the text (hood)");

    // ---- make it yours: the name appears on the back
    await toSection(page, "back");
    st = await debugState(page);
    assert.ok(Math.abs(st.pose.az - Math.PI) < 0.1, "square-on to the back");
    await page.getByLabel("Try a name").fill("aryan k.");
    assert.equal(await page.getByLabel("Try a name").inputValue(), "ARYAN K.", "capitals, filtered");
    await sleep(2500);
    await shot("05-back-name");
    const decal = await page.evaluate(() => {
      const h = window.__homeScene;
      const hood = h.scene.getObjectByName("hoodie").parent;
      const d = hood.children.find((c) => c.isMesh && c.name === "" && c.renderOrder === 2);
      return d ? { visible: d.visible, verts: d.geometry.attributes.position.count } : null;
    });
    assert.ok(decal?.visible && decal.verts > 50, `the name decal exists and conforms to the cloth (${JSON.stringify(decal)})`);

    // ---- colourways animate
    await toSection(page, "colour");
    await shot("06-colour-before");
    const before = (await debugState(page)).bodyColor;
    // Record the body colour on every animation frame, so the fade is measured rather than sampled at a guessed moment.
    await page.evaluate(() => {
      window.__samples = [];
      const tint = window.__homeScene.scene.getObjectByName("hoodie").material.userData.tint;
      const loop = () => {
        window.__samples.push(tint.uBody.value.getHexString());
        if (!window.__stopSamples) requestAnimationFrame(loop);
      };
      window.__stopSamples = false;
      loop();
    });
    await page.getByRole("radio", { name: /Lake/ }).click();
    await sleep(6000);
    const samples = await page.evaluate(() => ((window.__stopSamples = true), window.__samples));
    const path = samples.filter((c, i) => i === 0 || c !== samples[i - 1]);
    const after = await debugState(page);
    assert.equal(path[0], before);
    assert.equal(after.bodyColor, "1f3a4d", "ended on the Lake body colour");
    assert.equal(after.stitch, "ffb547", "and its stitch colour");
    assert.ok(path.length >= 3, `it faded through in-between colours rather than snapping: ${path.join(" > ")}`);
    await shot("07-colour-lake");
    await page.getByRole("radio", { name: /Ember/ }).click();
    await sleep(2200);
    await shot("08-colour-ember");

    await toSection(page, "wide");
    await shot("09-how");
    await page.evaluate(() => document.querySelector("[data-section='6']").scrollIntoView({ block: "center" }));
    await sleep(3500);
    st = await debugState(page);
    assert.ok(st.pose.r > 2 && st.pose.orbit > 0.99, "the CTA frames the hoodie like the hero again");
    await shot("10-cta");

    // ---- drag to orbit, then it resumes by itself; double-tap resets
    await page.evaluate(() => scrollTo(0, 0));
    await sleep(3000);
    const w = viewport.width;
    const h = viewport.height;
    await page.mouse.move(w * 0.55, h * 0.4);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(w * 0.55 - i * 40, h * 0.4 + i * 4, { steps: 2 });
    await page.mouse.up();
    const releasedAt = Date.now();
    await sleep(500);
    st = await debugState(page);
    assert.equal(st.stage.mode, "user", "dragging hands the camera to the visitor");
    await sleep(1200);
    assert.equal((await debugState(page)).stage.mode, "user", "it keeps its hands off while the visitor is mid-look");
    await shot("11-dragged");
    // It resumes on its own about 3 s after the drag ended (measured against the clock, not the sleeps above).
    let resumedAt = 0;
    for (let i = 0; i < 60 && !resumedAt; i++) {
      if ((await debugState(page)).stage.mode !== "user") resumedAt = Date.now();
      else await sleep(150);
    }
    assert.ok(resumedAt, "it resumed by itself");
    const waited = (resumedAt - releasedAt) / 1000;
    assert.ok(waited >= 2.8 && waited <= 6, `it resumed after ~3 s of stillness (${waited.toFixed(1)} s)`);
    // The rig clamps each frame to 0.1 s, so a software renderer at a few fps needs real seconds to finish a 1.4 s blend.
    assert.equal(await until(page, "script", 30000), true, "and the blend completes");
    // reset by double-click
    await page.mouse.move(w * 0.55, h * 0.4);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(w * 0.55 + i * 40, h * 0.4, { steps: 2 });
    await page.mouse.up();
    await sleep(400);
    assert.equal((await debugState(page)).stage.mode, "user");
    await page.mouse.dblclick(w * 0.55, h * 0.4);
    await sleep(300);
    assert.notEqual((await debugState(page)).stage.mode, "user", "double-click starts an eased reset");
    assert.equal(await until(page, "script", 30000), true, "and it settles back on the scripted view");
    await ctx.close();
  }

  // ---- product page: the live 3D viewer
  if (!ONLY || ONLY === "product") {
    const { ctx, page, shot } = await scene(browser, "product", { width: 1280, height: 860 });
    await page.goto(`${BASE}/shop/ash?debug`);
    await page.locator("label.chip", { hasText: /^M$/ }).click();
    await shot("00-still"); // the studio still is there straight away
    await page.waitForFunction(() => window.__productScene, null, { timeout: 90000 });
    await page.waitForFunction(() => getComputedStyle(document.querySelector("canvas").closest(".transition-opacity")).opacity === "1", null, { timeout: 90000 });
    await frames(page, 8, "__productScene");
    await sleep(500);
    await shot("01-viewer");
    const read = () =>
      page.evaluate(() => {
        const h = window.__productScene;
        const body = h.scene.getObjectByName("hoodie");
        const root = body.parent;
        const decal = root.children.find((c) => c.isMesh && c.renderOrder === 2);
        return { body: body.material.userData.tint.uBody.value.getHexString(), az: Math.atan2(h.camera.position.x, h.camera.position.z), decal: decal ? { visible: decal.visible } : null };
      });
    const poll = async (pred, ms = 40000) => {
      for (const t0 = Date.now(); Date.now() - t0 < ms; ) {
        const st = await read();
        if (pred(st)) return st;
        await sleep(300);
      }
      return null;
    };
    assert.equal((await read()).body, "8e8c88", "starts in the Ash colourway");
    await page.locator("label.chip", { hasText: /^Slate$/ }).click();
    assert.ok(await poll((st) => st.body === "3b3f46"), "the viewer follows the colour chips");
    await page.getByLabel(/Name on the back/i).fill("sam lee");
    assert.ok(await poll((st) => Math.abs(Math.abs(st.az) - Math.PI) < 0.12), "typing a name swings the viewer round to the back");
    assert.ok((await read()).decal?.visible, "and the name is printed on it");
    await sleep(1500);
    await shot("02-back-name");
    const box = await page.locator("canvas").boundingBox();
    const before = (await read()).az;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width * 0.5 + i * 25, box.y + box.height * 0.5, { steps: 2 });
    await page.mouse.up();
    await sleep(1200);
    assert.ok(Math.abs(wrapDiff((await read()).az, before)) > 0.15, "dragging turns the hoodie");
    await ctx.close();

    // a colourway with no studio photo shows a tinted hoodie instead of a broken image (3D off, so the still layer is visible)
    const noPhoto = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: "reduce" });
    const p2 = await noPhoto.newPage();
    watch(p2, "product no-photo");
    await p2.route("**/_next/image*", (route) => (route.request().url().includes("ash-slate") ? route.abort() : route.continue()));
    await p2.goto(`${BASE}/shop/ash`);
    await p2.locator("label.chip", { hasText: /^Slate$/ }).click();
    await p2.locator('[data-fallback="glyph"]').first().waitFor();
    await sleep(900); // let the chip and still cross-fades finish before the screenshot
    assert.equal(await p2.locator("canvas").count(), 0, "reduced motion keeps the product page on the still");
    await p2.screenshot({ path: `${OUT}/product-03-glyph-fallback.png` });
    await noPhoto.close();
  }

  // ---- static fallbacks: reduced motion, and no WebGL at all
  if (!ONLY || ONLY === "fallback") {
    for (const [label, ctxOpts, launchArgs] of [
      ["reduced-motion", { reducedMotion: "reduce" }, GL],
      ["no-webgl", {}, ["--disable-3d-apis", "--disable-gpu"]],
    ]) {
      const b = label === "no-webgl" ? await chromium.launch({ args: launchArgs }) : browser;
      for (const [vl, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
        const ctx = await b.newContext({ viewport, ...ctxOpts });
        const page = await ctx.newPage();
        watch(page, `${label} ${vl}`);
        await page.goto(`${BASE}/`);
        await page.getByRole("heading", { name: /Wear/ }).waitFor();
        await sleep(1500);
        assert.equal(await page.locator("canvas").count(), 0, `${label}: no canvas is created`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${label} ${vl}: no horizontal overflow`);
        await page.screenshot({ path: `${OUT}/${label}-${vl}-01-hero.png` });
        // the sections still work: name preview + colour chips drive the static render
        await page.evaluate(() => document.querySelector('[data-shot="back"]').scrollIntoView({ block: "center" }));
        await page.getByLabel("Try a name").fill("sam");
        await sleep(600);
        await page.screenshot({ path: `${OUT}/${label}-${vl}-02-back-name.png` });
        await page.evaluate(() => document.querySelector('[data-shot="colour"]').scrollIntoView({ block: "center" }));
        await page.getByRole("radio", { name: /Ash/ }).click();
        await sleep(600);
        await page.screenshot({ path: `${OUT}/${label}-${vl}-03-colour.png` });
        await ctx.close();
      }
      if (b !== browser) await b.close();
    }
  }
} finally {
  await browser.close(); // never leave a browser behind
}
console.log(problems.length ? `PROBLEMS:\n${problems.join("\n")}` : "home walkthrough passed");
process.exit(problems.length ? 1 : 0);

import assert from "node:assert/strict";
import { test } from "node:test";
import { placeCallout } from "@/components/home/callout-layout";
import { rimFor } from "@/components/home/colors";
import { aspectBoost, SECTION_SHOTS, shotsFor, wrapPi } from "@/components/home/shots";

test("wrapPi keeps any angle in (-PI, PI] without changing where it points", () => {
  for (const a of [0, 1, -1, 3, 4, 7, -7, 100, -100, Math.PI, -Math.PI]) {
    const w = wrapPi(a);
    assert.ok(w >= -Math.PI - 1e-9 && w <= Math.PI + 1e-9, `${a} -> ${w}`);
    assert.ok(Math.abs(Math.sin(w) - Math.sin(a)) < 1e-9 && Math.abs(Math.cos(w) - Math.cos(a)) < 1e-9, `${a} still points the same way`);
  }
});

test("narrow screens pull the camera back so the hoodie stays in frame; wide ones don't", () => {
  assert.equal(aspectBoost(16 / 9), 1);
  assert.equal(aspectBoost(1), 1);
  assert.ok(aspectBoost(390 / 844) > 1.5);
  assert.ok(aspectBoost(0.1) <= 2.2, "capped");
});

test("every section has shots, and each shot is defined for desktop and phone", () => {
  const desktop = shotsFor(false);
  const phone = shotsFor(true);
  assert.equal(SECTION_SHOTS.length, 7);
  for (const names of SECTION_SHOTS) for (const n of names) assert.ok(desktop[n] && phone[n], n);
  assert.equal(desktop.hero.orbit, 1, "the hero idles in orbit");
  assert.equal(desktop.back.orbit, 0);
  assert.ok(Math.abs(desktop.back.az - Math.PI) < 1e-9, "the back shot is square-on");
  assert.equal(desktop.colour.spin, 1, "colourways spin slowly");
});

test("on a phone the hoodie is never pushed sideways under the text; the text sits below it", () => {
  const phone = shotsFor(true);
  for (const p of Object.values(phone)) assert.equal(p.ox, 0);
  assert.ok(phone.hero.oy > 0, "lifted into the upper half");
});

test("the picture always moves away from the text column on desktop", () => {
  const d = shotsFor(false);
  assert.ok(d.hero.ox > 0 && d.fabric.ox > 0 && d.hood.ox > 0 && d.back.ox > 0, "text on the left: picture goes right");
  assert.ok(d.cuff.ox < 0, "text on the right: picture goes left");
});

test("the rim light complements the colourway", () => {
  const hue = (hex: string) => {
    const c = rimFor(hex, "#ffffff");
    return c;
  };
  assert.equal(rimFor("#0E0E10", "#E01E0A"), "#E01E0A", "a black hoodie takes its thread colour");
  assert.equal(rimFor("#8E8C88", "#0E0E10"), "#ff3b1f", "a grey one with dark thread falls back to the brand red");
  assert.notEqual(hue("#1F3A4D"), "#1f3a4d", "a blue body gets the opposite hue");
  const lake = rimFor("#1F3A4D", "#FFB547");
  assert.match(lake, /^#[0-9a-f]{6}$/);
  const r = parseInt(lake.slice(1, 3), 16);
  const b = parseInt(lake.slice(5, 7), 16);
  assert.ok(r > b, `blue's complement is warm (${lake})`);
});

test("a callout opens toward the free side and flips only when the label would leave the screen", () => {
  const base = { width: 1440, height: 900, top: 56, sy: 400, chars: 18, prefer: "right" as const, portrait: false };
  assert.equal(placeCallout({ ...base, sx: 600 }).side, "right");
  assert.equal(placeCallout({ ...base, sx: 1400 }).side, "left", "no room on the right, so it flips");
  assert.equal(placeCallout({ ...base, sx: 40, prefer: "left" }).side, "right", "same on the left edge");
});

test("on a phone a label wraps into the room it has, or is hidden when there is none", () => {
  const phone = { width: 390, height: 844, top: 56, sy: 400, portrait: true, prefer: "right" as const };
  const fits = placeCallout({ ...phone, sx: 60, chars: 8 });
  assert.equal(fits.side, "right");
  assert.ok(fits.fits && fits.leader < 64, "short leader on a phone");

  const flipped = placeCallout({ ...phone, sx: 200, chars: 16 });
  assert.equal(flipped.side, "left", "takes the side with room so the label shows in full");
  assert.ok(flipped.max >= 16 * 7.95 + 18);

  const wrapped = placeCallout({ ...phone, sx: 195, chars: 22 });
  assert.ok(wrapped.fits && wrapped.max < 22 * 7.95 + 18, `neither side fits the full label, so it wraps (max ${wrapped.max})`);

  const none = placeCallout({ ...phone, sx: 385, prefer: "right", chars: 16 });
  assert.equal(none.side, "left", "flips to the side that has room");
  const cornered = placeCallout({ width: 120, height: 844, top: 56, sy: 400, portrait: true, prefer: "right", sx: 60, chars: 16 });
  assert.equal(cornered.fits, false, "hidden when neither side can hold even a short label");
});

test("a dot that is off screen or under the header gets no label", () => {
  const o = { width: 390, height: 844, top: 56, chars: 9, prefer: "right" as const, portrait: true, sx: 100, sy: 400 };
  assert.equal(placeCallout(o).fits, true);
  assert.equal(placeCallout({ ...o, sy: -95 }).fits, false, "above the screen");
  assert.equal(placeCallout({ ...o, sy: 30 }).fits, false, "under the header");
  assert.equal(placeCallout({ ...o, sy: 900 }).fits, false, "below the screen");
  assert.equal(placeCallout({ ...o, sx: 496 }).fits, false, "right of the screen");
  assert.equal(placeCallout({ ...o, sx: -20 }).fits, false, "left of the screen");
});

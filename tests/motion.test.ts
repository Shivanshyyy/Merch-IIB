import assert from "node:assert/strict";
import { test } from "node:test";
import { bootProgress, counterText } from "@/components/home/boot";
import { marqueeParts } from "@/components/layout/marquee-text";
import { lineIndexes, revealDelay, splitWords } from "@/lib/reveal";
import { wipeDestination, wipeLabel } from "@/lib/transition";

test("headlines split into words with punctuation attached", () => {
  assert.deepEqual(splitWords("Wear the  campus."), ["Wear", "the", "campus."]);
  assert.deepEqual(splitWords("  Cuffs &\n stitching "), ["Cuffs", "&", "stitching"]);
  assert.deepEqual(splitWords(""), []);
});

test("words on the same visual line share a line number, and lines cascade", () => {
  assert.deepEqual(lineIndexes([10, 10, 11, 52, 52, 94]), [0, 0, 0, 1, 1, 2]);
  assert.ok(revealDelay(1, 0) > revealDelay(0, 2), "a new line starts after the previous one's last word");
  assert.equal(revealDelay(0, 0), 0);
});

test("the boot counter only moves forward, never reaches 100 before the first frame, and ends at exactly 100", () => {
  const base = { modelTotal: 1_000_000, ready: false };
  let last = -1;
  for (let i = 0; i <= 20; i++) {
    const p = bootProgress({ ...base, elapsedMs: i * 300, modelBytes: i * 60_000 });
    assert.ok(p >= last, `monotonic at step ${i}`);
    assert.ok(p <= 0.99, "held back until ready");
    last = p;
  }
  assert.equal(bootProgress({ ...base, elapsedMs: 5000, modelBytes: 1_000_000, ready: true }), 1);
  assert.ok(bootProgress({ ...base, elapsedMs: 5000, modelBytes: 5_000_000 }) <= 0.99, "over-reported bytes are clamped");
  assert.ok(bootProgress({ elapsedMs: 800, modelBytes: 0, modelTotal: 0, ready: false }) > 0, "moves even when the size is unknown");
});

test("the counter is always three digits", () => {
  assert.equal(counterText(0), "000");
  assert.equal(counterText(0.074), "007");
  assert.equal(counterText(0.5), "050");
  assert.equal(counterText(1), "100");
  assert.equal(counterText(1.7), "100");
  assert.equal(counterText(-1), "000");
});

const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
const here = { origin: "https://merch.test", pathname: "/" };
const a = (href: string, extra: Partial<{ target: string; download: boolean }> = {}) => ({ href, target: "", download: false, ...extra });

test("only plain clicks on links to other pages play the wipe", () => {
  assert.equal(wipeDestination(click, a("/shop"), here)?.pathname, "/shop");
  assert.equal(wipeDestination(click, a("https://merch.test/cart?x=1"), here)?.search, "?x=1");
  assert.equal(wipeDestination({ ...click, metaKey: true }, a("/shop"), here), null, "cmd-click opens a tab");
  assert.equal(wipeDestination({ ...click, button: 1 }, a("/shop"), here), null, "middle click");
  assert.equal(wipeDestination({ ...click, defaultPrevented: true }, a("/shop"), here), null);
  assert.equal(wipeDestination(click, a("/shop", { target: "_blank" }), here), null);
  assert.equal(wipeDestination(click, a("/file.csv", { download: true }), here), null);
  assert.equal(wipeDestination(click, a("https://wa.me/910000000000"), here), null, "other sites");
  assert.equal(wipeDestination(click, a("mailto:x@y.z"), here), null);
  assert.equal(wipeDestination(click, a("/"), here), null, "same page");
  assert.equal(wipeDestination(click, a("/#how"), here), null, "hash on the same page");
  assert.equal(wipeDestination(click, a("/shop?size=M"), { ...here, pathname: "/shop" }), null, "filters on the same page");
});

test("the admin panel and API never get the wipe", () => {
  assert.equal(wipeDestination(click, a("/admin/orders"), here), null);
  assert.equal(wipeDestination(click, a("/api/me"), here), null);
  assert.equal(wipeDestination(click, a("/shop"), { ...here, pathname: "/admin" }), null);
});

test("the wipe is labelled with the page being opened", () => {
  assert.equal(wipeLabel("/shop/ash", "MERCH—IITB"), "Shop");
  assert.equal(wipeLabel("/orders", "MERCH—IITB"), "My orders");
  assert.equal(wipeLabel("/order/HD-7K4Q/pay", "MERCH—IITB"), "Payment");
  assert.equal(wipeLabel("/", "MERCH—IITB"), "MERCH—IITB");
  assert.equal(wipeLabel("/something-new", "MERCH—IITB"), "MERCH—IITB");
});

test("the strip reads like the spec, and says so when preorders are closed", () => {
  assert.deepEqual(marqueeParts({ batchName: "Batch 01", secondsLeft: 3 * 86400 + 14 * 3600 + 22 * 60, pickup: "Hostel 4" }), ["PREORDER BATCH 01", "CLOSES IN 03D 14H 22M", "PICKUP AT HOSTEL 4"]);
  assert.deepEqual(marqueeParts({ batchName: null, secondsLeft: null, pickup: "Hostel 4" }), ["PREORDERS CLOSED", "NEXT BATCH SOON", "PICKUP AT HOSTEL 4"]);
  assert.equal(marqueeParts({ batchName: "Batch 01", secondsLeft: 0, pickup: "Hostel 4" })[0], "BATCH 01 IS CLOSED");
  assert.equal(marqueeParts({ batchName: "Batch 01", secondsLeft: null, pickup: "Hostel 4" })[1], "CLOSES IN --D --H --M", "before the clock is known");
});

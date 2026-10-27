// Where a callout's label goes: which side of its dot, how long the leader is, and how much width the label gets.
// Labels are mono, so a label's natural width follows from its length and nothing has to be measured.
const CHAR = 7.95; // one character at 11px with 0.12em tracking
const PAD = 18; // label padding and border
const GAP = 8; // between the end of the leader and the label
const MARGIN = 12; // keep clear of the screen edge
const MIN_LABEL = 64; // narrower than this isn't worth showing

export type CalloutPlace = { side: "left" | "right"; leader: number; max: number; fits: boolean };

// `sx`/`sy` is where the dot lands on screen; `top` is the bottom edge of the header. A dot that is off screen, or under
// the header, has no label.
export function placeCallout(o: { sx: number; sy: number; width: number; height: number; top: number; chars: number; prefer: "left" | "right"; portrait: boolean }): CalloutPlace {
  const leader = o.portrait ? 28 : 64;
  const natural = o.chars * CHAR + PAD;
  const room = (side: "left" | "right") => (side === "right" ? o.width - o.sx : o.sx) - leader - GAP - MARGIN;

  let side = o.prefer;
  const other = side === "right" ? "left" : "right";
  if (room(side) < natural && room(other) > room(side)) side = other;
  const max = Math.max(0, room(side));
  const onScreen = o.sx > 0 && o.sx < o.width && o.sy > o.top && o.sy < o.height;
  return { side, leader, max, fits: onScreen && max >= Math.min(natural, MIN_LABEL) };
}

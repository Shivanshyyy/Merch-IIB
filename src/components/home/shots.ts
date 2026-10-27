// Named camera shots. Spherical around a target: az 0 = looking at the front (+z), PI = the back.
// ox/oy shift the picture sideways/upwards as a fraction of the viewport (+ox = picture moves right, +oy = up),
// so the hoodie can sit beside the text instead of under it.
export type Pose = { az: number; el: number; r: number; tx: number; ty: number; tz: number; fov: number; ox: number; oy: number; orbit: number; spin: number };
export type ShotName = "hero" | "fabric" | "cuff" | "hood" | "back" | "colour" | "wide";

const P = (over: Partial<Pose>): Pose => ({ az: 0, el: 0.1, r: 2.4, tx: 0, ty: 0, tz: 0, fov: 28, ox: 0, oy: 0, orbit: 0, spin: 0, ...over });

// Coordinates are in metres around the hoodie's centre (it is ~0.6 wide, 0.64 tall, front on +z).
const DESKTOP: Record<ShotName, Pose> = {
  hero: P({ az: 0, el: 0.12, r: 2.45, ox: 0.2, oy: 0.02, orbit: 1 }), // the hoodie fills about 55% of the screen height
  fabric: P({ az: 0.5, el: 0.05, r: 0.95, ty: 0.05, tz: 0.1, ox: 0.17 }), // text on the left: picture goes right
  cuff: P({ az: -0.45, el: 0.12, r: 0.85, tx: -0.2, ty: -0.25, tz: 0.05, ox: -0.16 }), // text on the right: picture goes left
  hood: P({ az: 2.3, el: 0.28, r: 1.0, ty: 0.2, tz: -0.04, ox: 0.16 }),
  back: P({ az: Math.PI, el: 0.03, r: 1.6, ty: 0.03, tz: -0.1, ox: 0.18 }),
  colour: P({ az: 0.7, el: 0.1, r: 1.95, spin: 1 }),
  wide: P({ az: 0.3, el: 0.22, r: 3.6, ty: -0.05, oy: -0.2 }),
};

// Portrait phones: the hoodie sits in the upper half and the text takes the lower half.
const PHONE: Record<ShotName, Pose> = {
  hero: { ...DESKTOP.hero, r: 2.1, ox: 0, oy: 0.2 },
  fabric: { ...DESKTOP.fabric, ox: 0, oy: 0.2 },
  cuff: { ...DESKTOP.cuff, ox: 0, oy: 0.2 },
  hood: { ...DESKTOP.hood, ox: 0, oy: 0.2 },
  back: { ...DESKTOP.back, ox: 0, oy: 0.18 },
  colour: { ...DESKTOP.colour, ox: 0, oy: 0.2 },
  wide: { ...DESKTOP.wide, ox: 0, oy: 0.12 },
};

export const shotsFor = (portrait: boolean) => (portrait ? PHONE : DESKTOP);

// One shot per section; the details section has two (cuff, then hood).
export const SECTION_SHOTS: ShotName[][] = [["hero"], ["fabric"], ["cuff", "hood"], ["back"], ["colour"], ["wide"], ["hero"]];

// Narrow screens need the camera further back to keep the hoodie inside the frame.
export const aspectBoost = (aspect: number) => Math.min(2.2, Math.max(1, 0.82 / aspect));

export const wrapPi = (a: number) => ((((a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;

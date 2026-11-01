// Where the name preview sits on each product's back still, in % of the (square) picture.
// Products without an entry (e.g. added later in admin with uploaded photos) show no live preview.
export type NameSpot = { x: number; y: number; size: number; maxWidth: number }; // size: font cqw at most; maxWidth: cqw the longest name may take

const SPOTS: Record<string, NameSpot> = {
  "iit-bombay-hoodie": { x: 50.5, y: 83, size: 9, maxWidth: 62 },
  "iit-bombay-zip-hoodie": { x: 50.5, y: 83, size: 9, maxWidth: 62 }, // same print and back crop as the pullover
  "oversized-tee": { x: 75.4, y: 50, size: 3.8, maxWidth: 25 },
  "regular-tee": { x: 75.4, y: 56, size: 3.8, maxWidth: 25 }, // a little lower, clear of EST. 1958
};

export const nameSpot = (slug: string): NameSpot | null => SPOTS[slug] ?? null;

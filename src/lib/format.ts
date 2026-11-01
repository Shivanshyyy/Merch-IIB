export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// Fixed zone so server and client render the same string.
export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));

export const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(iso));

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export type StillView = "front" | "back";

export const colorwayImage = (productSlug: string, colorwayName: string, view: StillView = "front") =>
  `/products/${productSlug}-${slugify(colorwayName)}-${view}.webp`;

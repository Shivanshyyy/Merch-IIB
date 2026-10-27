import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Share previews: a per-product picture if one was generated (scripts/make-og.mjs), otherwise the site-wide one.
// Products added later in the admin simply use the site-wide image.
export function ogImageFor(slug: string | null): string {
  if (slug && existsSync(join(process.cwd(), "public", "og", `${slug}.jpg`))) return `/og/${slug}.jpg`;
  return "/og.jpg";
}

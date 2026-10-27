// Rules for the red page wipe: which clicks play it, and what it says.

type ClickLike = { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean };
type AnchorLike = { href: string; target: string; download: boolean };

// Paths that keep their own shell or are not pages.
const SKIP = /^\/(admin|api|_next)(\/|$)/;

// The destination URL if this click is a plain in-app navigation to another page, otherwise null (browser/Next handle it).
export function wipeDestination(e: ClickLike, a: AnchorLike, here: { origin: string; pathname: string }): URL | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  if (a.download || (a.target && a.target !== "_self")) return null;
  let url: URL;
  try {
    url = new URL(a.href, here.origin);
  } catch {
    return null;
  }
  if (url.origin !== here.origin) return null;
  if (url.pathname === here.pathname) return null; // same page: filters, hashes, query changes just happen
  if (SKIP.test(url.pathname) || SKIP.test(here.pathname)) return null;
  return url;
}

const LABELS: Record<string, string> = {
  shop: "Shop",
  cart: "Cart",
  checkout: "Checkout",
  order: "Payment",
  orders: "My orders",
  account: "Account",
  login: "Log in",
  policies: "Policies",
  track: "My orders",
};

// The word written across the wipe for the page being opened.
export function wipeLabel(pathname: string, brand: string): string {
  const first = pathname.split("/").filter(Boolean)[0];
  return first ? (LABELS[first] ?? brand) : brand;
}

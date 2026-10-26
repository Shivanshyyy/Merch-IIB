"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { site } from "@/config/site";
import { cartCount, useCart, useCartHydration } from "@/store/cart";

const LINKS = [
  { href: "/shop", label: "Shop" },
  { href: "/track", label: "Track" },
];

function LinkList({ pathname }: { pathname: string }) {
  return LINKS.map((l) => {
    const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
    return (
      <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={`label flex min-h-11 items-center px-2.5 transition-colors hover:text-fg ${active ? "text-fg" : ""}`}>
        {l.label}
      </Link>
    );
  });
}

// usePathname() suspends on dynamic routes, so it lives in its own boundary with a same-shape fallback.
function ActiveLinks() {
  return <LinkList pathname={usePathname()} />;
}

export function Nav() {
  useCartHydration();
  const count = useCart((s) => cartCount(s.lines));
  const hydrated = useCart((s) => s.hydrated);
  const bumps = useCart((s) => s.bumps);
  const openDrawer = useCart((s) => s.openDrawer);
  const badge = useRef<HTMLSpanElement>(null);
  const [left, right] = site.brand.split("—");

  // Restart the CSS keyframe on every add so the badge bumps even for identical counts.
  useEffect(() => {
    const el = badge.current;
    if (!el || bumps === 0) return;
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "bump 0.45s var(--ease)";
  }, [bumps]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-bg/80 backdrop-blur-md">
      <a href="#main" className="absolute left-4 top-2 z-10 -translate-y-20 bg-accent px-3 py-2 font-mono text-xs uppercase text-bg focus:translate-y-0">
        Skip to content
      </a>
      <nav aria-label="Main" className="shell flex h-[var(--nav-h)] items-center justify-between">
        <Link href="/" className="font-mono text-[0.8rem] font-medium tracking-[0.2em]" aria-label={`${site.brand} home`}>
          {right !== undefined ? (
            <>
              {left}
              <span className="text-accent">—</span>
              {right}
            </>
          ) : (
            site.brand
          )}
        </Link>
        <div className="flex items-center gap-1 sm:gap-3">
          <Suspense fallback={<LinkList pathname="" />}>
            <ActiveLinks />
          </Suspense>
          <button
            type="button"
            onClick={openDrawer}
            className="label flex min-h-11 items-center gap-2 border border-line px-3 text-fg transition-colors hover:border-fg"
            aria-label={`Open cart, ${hydrated ? count : 0} items`}
          >
            Cart
            <span ref={badge} className="mono grid min-w-[1.4rem] place-items-center bg-accent px-1 text-[0.7rem] font-medium leading-[1.4rem] text-bg" style={{ opacity: hydrated && count > 0 ? 1 : 0.35 }}>
              {hydrated ? count : 0}
            </span>
          </button>
        </div>
      </nav>
    </header>
  );
}

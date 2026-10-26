"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";

const TABS = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/batches", label: "Batches" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/vendor", label: "Vendor sheet" },
  { href: "/admin/settings", label: "Settings" },
];

function Tabs({ pathname, badge }: { pathname: string; badge: ReactNode }) {
  return (
    <ul className="flex min-w-max gap-1">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-2 border-b-2 px-3 text-[0.9rem] transition-colors hover:text-fg ${active ? "border-accent text-fg" : "border-transparent text-muted"}`}
            >
              {t.label}
              {t.href === "/admin/orders" && badge}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Active({ badge }: { badge: ReactNode }) {
  const pathname = usePathname();
  // On a phone the strip scrolls sideways: keep the current tab in view.
  useEffect(() => {
    document.querySelector("nav[aria-label=Admin] [aria-current=page]")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname]);
  return <Tabs pathname={pathname} badge={badge} />;
}

// usePathname() suspends on dynamic routes, so it gets its own boundary with a same-shape fallback.
export function AdminNav({ pendingCount }: { pendingCount: number }) {
  const badge = pendingCount > 0 ? <span className="mono grid min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[0.7rem] font-medium leading-5 text-bg">{pendingCount}</span> : null;
  return (
    <div className="relative">
      <nav aria-label="Admin" className="overflow-x-auto [scrollbar-width:none]">
        <Suspense fallback={<Tabs pathname="" badge={badge} />}>
          <Active badge={badge} />
        </Suspense>
      </nav>
      {/* A fade on the right edge says "more tabs this way" on narrow screens. */}
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-bg to-transparent md:hidden" />
    </div>
  );
}

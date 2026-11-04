"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const TABS = [
  { href: "/designer", label: "Dashboard", exact: true },
  { href: "/designer/designs", label: "My designs" },
  { href: "/designer/earnings", label: "Earnings" },
  { href: "/designer/profile", label: "Profile" },
];

function Tabs({ pathname }: { pathname: string }) {
  return (
    <ul className="flex min-w-max gap-1">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <li key={t.href}>
            <Link href={t.href} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center border-b-2 px-3 text-[0.9rem] transition-colors hover:text-fg ${active ? "border-fg text-fg" : "border-transparent text-muted"}`}>
              {t.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Active() {
  return <Tabs pathname={usePathname()} />;
}

// usePathname() suspends on dynamic routes, so it gets its own boundary with a same-shape fallback.
export function DesignerNav() {
  return (
    <nav aria-label="Designer" className="mb-10 overflow-x-auto border-b border-line [scrollbar-width:none]">
      <Suspense fallback={<Tabs pathname="" />}>
        <Active />
      </Suspense>
    </nav>
  );
}

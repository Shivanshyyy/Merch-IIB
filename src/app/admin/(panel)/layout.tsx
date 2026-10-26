import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { adminLogout } from "@/actions/admin/auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";

// The shell is static; the session check and the pending-count badge stream in behind Suspense.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <Link href="/admin" className="font-mono text-[0.8rem] font-medium tracking-[0.2em]">
            ADMIN<span className="text-accent">—</span>PANEL
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/" target="_blank" className="admin-label flex min-h-11 items-center px-3 hover:text-fg">
              View site ↗
            </Link>
            <form action={adminLogout}>
              <button type="submit" className="admin-label flex min-h-11 items-center px-3 hover:text-fg">
                Log out
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-[1400px] px-2 sm:px-5">
          <Suspense fallback={<AdminNav pendingCount={0} />}>
            <NavWithBadge />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        <Suspense fallback={<div className="skeleton h-64" aria-hidden />}>
          <Gate>{children}</Gate>
        </Suspense>
      </main>
    </div>
  );
}

async function NavWithBadge() {
  await requireAdmin();
  const { total } = await db().searchOrders({ payment: "pending", limit: 1, offset: 0 });
  return <AdminNav pendingCount={total} />;
}

// Defence in depth: proxy.ts already guards /admin, and every server action re-checks the cookie.
async function Gate({ children }: { children: ReactNode }) {
  await requireAdmin();
  return children;
}

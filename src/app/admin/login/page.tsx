import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminLoginForm } from "@/components/admin/LoginForm";
import { FreshOnVisit } from "@/components/ui/FreshOnVisit";
import { adminConfig, safeAdminNext } from "@/lib/admin/token";

export const metadata: Metadata = { title: "Log in" };

type Props = { searchParams: Promise<{ next?: string }> };

export default function AdminLoginPage({ searchParams }: Props) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="font-mono text-[0.8rem] font-medium tracking-[0.2em]">
          ADMIN<span className="text-accent">—</span>PANEL
        </p>
        <h1 className="t-display mt-6 text-3xl">Log in</h1>
        <div className="mt-8">
          <Suspense fallback={<div className="skeleton h-40" aria-hidden />}>
            <Form searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function Form({ searchParams }: Props) {
  const { next } = await searchParams;
  const cfg = adminConfig();
  if (!cfg.ready) {
    return (
      <p role="alert" className="border border-accent p-4 text-[#ff7a63]">
        The admin panel isn&apos;t set up yet. Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET (32+ characters) in the environment.
      </p>
    );
  }
  return (
    <>
      {cfg.demo && (
        <p className="admin-label mb-5 border border-dashed border-accent-2 p-3 leading-relaxed text-accent-2">
          Demo mode: no ADMIN_PASSWORD is set, so the password is <span className="mono">admin</span>.
        </p>
      )}
      <FreshOnVisit>
        <AdminLoginForm next={safeAdminNext(next)} />
      </FreshOnVisit>
    </>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { FreshOnVisit } from "@/components/ui/FreshOnVisit";
import { whatsappUrl } from "@/config/site";
import { authMode } from "@/lib/auth/mode";
import { safeNext } from "@/lib/auth/next";
import { getSessionUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Log in" };

type Props = { searchParams: Promise<{ next?: string; mode?: string }> };

export default function LoginPage({ searchParams }: Props) {
  return (
    <div className="page ember">
      <div className="shell">
        <Suspense fallback={<div className="skeleton h-[520px]" aria-hidden />}>
          <Login searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Login({ searchParams }: Props) {
  const { next, mode } = await searchParams;
  const dest = safeNext(next);
  if (await getSessionUser()) redirect(dest);
  const settings = await getSettings();
  const am = authMode();

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_minmax(0,480px)] lg:gap-24">
      <div>
        <p className="label">[ 00 ] — Your account</p>
        <h1 className="t-display t-h1 mt-4">
          Log in
          <br />
          to order
        </h1>
        <p className="mt-8 max-w-md text-muted">Browse and fill your cart without an account. You only need one to check out and to follow your orders from payment to pickup.</p>
        <ul className="mt-10 grid max-w-md gap-4 text-[0.95rem]">
          {["Email and password. No codes, no verification emails.", "Your details are saved, so checkout takes seconds.", "Every order and its status in one place."].map((t) => (
            <li key={t} className="flex gap-3 border-t border-line pt-4">
              <span aria-hidden className="mono text-accent">
                +
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>

      <div>
        {am === "demo" && (
          <p className="label mb-6 border border-dashed border-accent-2 p-3 normal-case leading-relaxed tracking-normal text-accent-2">
            Demo mode: no Supabase keys are set, so accounts live in memory and reset when the server restarts.
          </p>
        )}
        {am === "unconfigured" ? (
          <p role="alert" className="border border-accent p-5 text-[#ff7a63]">
            Login isn&apos;t set up yet. The site owner needs to add SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.
          </p>
        ) : (
          <FreshOnVisit>
            <AuthPanel next={dest} initialMode={mode === "signup" ? "signup" : "login"} forgotHref={whatsappUrl(settings.whatsapp, "Hi, I forgot my password for my merch account. Can you set a new one?")} contactName={settings.contactName} />
          </FreshOnVisit>
        )}
      </div>
    </div>
  );
}

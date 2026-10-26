import type { Metadata } from "next";
import { Suspense } from "react";
import { logOut } from "@/actions/auth";
import { PasswordForm } from "@/components/auth/PasswordForm";
import { ProfileForm } from "@/components/auth/ProfileForm";
import { Button } from "@/components/ui/Button";
import { safeNext } from "@/lib/auth/next";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Account" };

type Props = { searchParams: Promise<{ next?: string }> };

export default function AccountPage({ searchParams }: Props) {
  return (
    <div className="page">
      <div className="shell">
        <Suspense fallback={<div className="skeleton h-[560px]" aria-hidden />}>
          <Account searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Account({ searchParams }: Props) {
  const { next } = await searchParams;
  const dest = next ? safeNext(next, "") : "";
  const user = await requireUser(dest ? `/account?next=${encodeURIComponent(dest)}` : "/account");
  const profile = await db().getProfile(user.id);

  return (
    <>
      <p className="label">[ 07 ] — Account</p>
      <h1 className="t-display t-h1 mt-4">{profile ? "Account" : "Finish up"}</h1>
      {!profile && <p className="mt-6 max-w-lg text-muted">Your login is ready, but we still need a few details before you can order.</p>}

      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-24">
        <section aria-labelledby="profile-h">
          <h2 id="profile-h" className="label mb-6 text-fg">
            [ Your details ]
          </h2>
          <ProfileForm email={user.email} profile={profile} next={dest || undefined} name={user.name} />
        </section>

        {profile && (
          <div className="grid content-start gap-12">
            <section aria-labelledby="pw-h">
              <h2 id="pw-h" className="label mb-6 text-fg">
                [ Change password ]
              </h2>
              <PasswordForm />
            </section>
            <section aria-label="Log out" className="border-t border-line pt-8">
              <form action={logOut}>
                <Button type="submit" variant="ghost">
                  Log out
                </Button>
              </form>
            </section>
          </div>
        )}
      </div>
    </>
  );
}

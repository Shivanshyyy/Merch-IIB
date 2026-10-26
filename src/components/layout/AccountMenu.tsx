import Link from "next/link";
import { AccountDropdown } from "@/components/layout/AccountDropdown";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

const SLOT = "flex h-11 w-[4.5rem] items-center justify-center";

export function AccountSkeleton() {
  return (
    <div className={SLOT} aria-hidden>
      <span className="skeleton size-8 rounded-full" />
    </div>
  );
}

// Streams in behind <Suspense>: reading the session is request-time work and can't be part of the static shell.
export async function AccountMenu() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <Link href="/login" className={`${SLOT} label border border-line text-fg transition-colors hover:border-fg`}>
        Log in
      </Link>
    );
  }
  const profile = await db().getProfile(user.id);
  return <AccountDropdown name={profile?.full_name ?? user.name ?? user.email} email={user.email} />;
}

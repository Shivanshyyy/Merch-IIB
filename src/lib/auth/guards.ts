import "server-only";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { Profile } from "@/lib/types";
import { loginPath } from "./next";
import { getSessionUser } from "./session";
import type { SessionUser } from "./types";

export async function requireUser(next: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(loginPath(next));
  return user;
}

// Logged in AND onboarded. A user with no profile row (sign-up half-finished) is sent to complete it.
export async function requireProfile(next: string): Promise<{ user: SessionUser; profile: Profile }> {
  const user = await requireUser(next);
  const profile = await db().getProfile(user.id);
  if (!profile) redirect(`/account?next=${encodeURIComponent(next)}`);
  return { user, profile };
}

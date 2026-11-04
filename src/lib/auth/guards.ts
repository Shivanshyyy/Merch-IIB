import "server-only";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { Designer, Profile } from "@/lib/types";
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

// A logged-in customer who has applied to be a designer. Anyone else is sent to the sign-up page.
export async function requireDesigner(next: string): Promise<{ user: SessionUser; profile: Profile; designer: Designer }> {
  const { user, profile } = await requireProfile(next);
  const designer = await db().getDesigner(user.id);
  if (!designer) redirect("/designers");
  return { user, profile, designer };
}

// Approved designers only (checked on every request, so suspending someone takes effect at once).
export async function requireApprovedDesigner(next: string): Promise<{ user: SessionUser; profile: Profile; designer: Designer & { commission_pct: number } }> {
  const { designer, ...rest } = await requireDesigner(next);
  if (designer.status !== "approved" || designer.commission_pct === null) redirect("/designer");
  return { ...rest, designer: { ...designer, commission_pct: designer.commission_pct } };
}

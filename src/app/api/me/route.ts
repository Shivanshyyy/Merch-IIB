import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

// Tiny "who am I" for client components (e.g. the product page pre-selecting the saved size). Never cached.
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const user = await getSessionUser();
  if (!user) return NextResponse.json(null, { headers });
  const profile = await db().getProfile(user.id);
  return NextResponse.json({ name: profile?.full_name ?? null, defaultSize: profile?.default_size ?? null }, { headers });
}

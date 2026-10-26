"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authBackend } from "@/lib/auth/backend";
import { safeNext } from "@/lib/auth/next";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/form-state";
import { changePasswordSchema, profileSchema } from "@/lib/schemas";

const text = (f: FormData, k: string) => String(f.get(k) ?? "");
const firstErrors = (error: z.ZodError) => Object.fromEntries(Object.entries(z.flattenError(error).fieldErrors).map(([k, v]) => [k, (v as string[])[0]]));

// Edits the profile, or finishes it for an account that signed up but has no profile row yet.
export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const next = text(formData, "next");
  const user = await requireUser(next ? `/account?next=${encodeURIComponent(next)}` : "/account");
  const values = Object.fromEntries(["fullName", "phone", "rollNo", "defaultSize"].map((k) => [k, text(formData, k)]));
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error), values };
  const d = parsed.data;
  const input = { full_name: d.fullName, phone: d.phone, roll_no: d.rollNo, default_size: d.defaultSize };

  try {
    const existing = await db().getProfile(user.id);
    if (existing) await db().updateProfile(user.id, input);
    else await db().createProfile(user.id, user.email, input);
  } catch (e) {
    console.error("[saveProfile]", e);
    return { message: "We couldn't save your details. Please try again.", values };
  }
  if (next) redirect(safeNext(next, "/account"));
  return { ok: true, message: "Saved.", values };
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/account");
  const parsed = changePasswordSchema.safeParse({ current: text(formData, "current"), next: text(formData, "next") });
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error) };

  const backend = authBackend();
  if (!(await backend.checkPassword(user.email, parsed.data.current))) {
    await new Promise((r) => setTimeout(r, 500));
    return { fieldErrors: { current: "That isn't your current password." } };
  }
  try {
    await backend.setPassword(user.id, parsed.data.next);
  } catch (e) {
    console.error("[changePassword]", e);
    return { message: "We couldn't change your password. Please try again." };
  }
  return { ok: true, message: "Password changed." };
}

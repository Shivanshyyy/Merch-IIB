"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authBackend } from "@/lib/auth/backend";
import { safeNext } from "@/lib/auth/next";
import { db, EmailTakenError } from "@/lib/db";
import type { FormState } from "@/lib/form-state";
import { logInSchema, signUpSchema } from "@/lib/schemas";

const text = (f: FormData, k: string) => String(f.get(k) ?? "");
const slow = () => new Promise((r) => setTimeout(r, 500)); // makes password guessing slower, whatever the outcome
const firstErrors = (error: z.ZodError) => Object.fromEntries(Object.entries(z.flattenError(error).fieldErrors).map(([k, v]) => [k, (v as string[])[0]]));

export async function logIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const next = safeNext(text(formData, "next"));
  const values = { email: text(formData, "email") };
  const parsed = logInSchema.safeParse({ email: values.email, password: text(formData, "password") });
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error), values };

  const result = await authBackend().signIn(parsed.data.email, parsed.data.password);
  if ("error" in result) {
    await slow();
    return { message: result.error === "invalid" ? "That email and password don't match." : "We couldn't log you in right now. Please try again.", values };
  }
  redirect(next);
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const next = safeNext(text(formData, "next"));
  const values = Object.fromEntries(["fullName", "email", "phone", "rollNo", "defaultSize"].map((k) => [k, text(formData, k)]));
  const parsed = signUpSchema.safeParse({ ...values, password: text(formData, "password") });
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error), values };
  const d = parsed.data;

  const backend = authBackend();
  const created = await backend.createUser(d.email, d.password, { fullName: d.fullName });
  if ("error" in created) {
    return created.error === "exists"
      ? { fieldErrors: { email: "An account with this email already exists. Log in instead." }, values }
      : { message: "We couldn't create your account right now. Please try again.", values };
  }

  try {
    await db().createProfile(created.id, d.email, { full_name: d.fullName, phone: d.phone, roll_no: d.rollNo, default_size: d.defaultSize });
  } catch (e) {
    await backend.deleteUser(created.id); // don't leave a login without a profile behind
    if (e instanceof EmailTakenError) return { fieldErrors: { email: "An account with this email already exists. Log in instead." }, values };
    console.error("[signUp] profile creation failed:", e);
    return { message: "We couldn't create your account right now. Please try again.", values };
  }

  const session = await backend.signIn(d.email, d.password);
  if ("error" in session) redirect(`/login?next=${encodeURIComponent(next)}`); // account exists; just log in
  redirect(next);
}

export async function logOut() {
  await authBackend().signOut();
  redirect("/");
}

"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { vaultPassword } from "@/lib/auth/vault";
import { authBackend } from "@/lib/auth/backend";
import { requireDesigner, requireProfile } from "@/lib/auth/guards";
import { db, EmailTakenError } from "@/lib/db";
import { designerApplySchema, designerDetailsSchema, designerSignUpSchema } from "@/lib/designer/schemas";
import type { FormState } from "@/lib/form-state";

const text = (f: FormData, k: string) => String(f.get(k) ?? "");
const firstErrors = (error: z.ZodError) => Object.fromEntries(Object.entries(z.flattenError(error).fieldErrors).map(([k, v]) => [k, (v as string[])[0]]));
const EXISTS = "An account with this email already exists. Log in, then apply from this page.";

// New person: creates the login, the customer profile and a pending designer application in one go.
export async function designerSignUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(["fullName", "email", "phone", "bio", "upiId", "agree"].map((k) => [k, text(formData, k)]));
  const parsed = designerSignUpSchema.safeParse({ ...values, password: text(formData, "password"), agree: text(formData, "agree") === "on" });
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error), values };
  const d = parsed.data;

  const backend = authBackend();
  const created = await backend.createUser(d.email, d.password, { fullName: d.fullName });
  if ("error" in created) {
    return created.error === "exists" ? { fieldErrors: { email: EXISTS }, values } : { message: "We couldn't create your account right now. Please try again.", values };
  }

  try {
    await db().createProfile(created.id, d.email, { full_name: d.fullName, phone: d.phone, roll_no: null, default_size: null });
  } catch (e) {
    await backend.deleteUser(created.id); // don't leave a login without a profile behind
    if (e instanceof EmailTakenError) return { fieldErrors: { email: EXISTS }, values };
    console.error("[designerSignUp] profile creation failed:", e);
    return { message: "We couldn't create your account right now. Please try again.", values };
  }

  await vaultPassword(created.id, d.password); // same encrypted copy customers get (best-effort)

  let applied = true;
  try {
    await db().createDesigner(created.id, { bio: d.bio, upi_id: d.upiId });
  } catch (e) {
    applied = false; // the account is fine; they can apply again while logged in
    console.error("[designerSignUp] application failed:", e);
  }

  const session = await backend.signIn(d.email, d.password);
  if ("error" in session) redirect("/login?next=%2Fdesigner");
  redirect(applied ? "/designer" : "/designers");
}

// Someone who already shops here applies with the account they have.
export async function applyAsDesigner(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireProfile("/designers");
  const values = Object.fromEntries(["bio", "upiId", "agree"].map((k) => [k, text(formData, k)]));
  const parsed = designerApplySchema.safeParse({ ...values, agree: text(formData, "agree") === "on" });
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error), values };

  if (!(await db().getDesigner(user.id))) {
    try {
      await db().createDesigner(user.id, { bio: parsed.data.bio, upi_id: parsed.data.upiId });
    } catch (e) {
      console.error("[applyAsDesigner]", e);
      return { message: "We couldn't send your application. Please try again.", values };
    }
  }
  redirect("/designer");
}

export async function saveDesignerDetails(_prev: FormState, formData: FormData): Promise<FormState> {
  const { designer } = await requireDesigner("/designer/profile");
  const values = Object.fromEntries(["bio", "upiId"].map((k) => [k, text(formData, k)]));
  const parsed = designerDetailsSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error), values };

  try {
    await db().updateDesigner(designer.id, { bio: parsed.data.bio, upi_id: parsed.data.upiId });
  } catch (e) {
    console.error("[saveDesignerDetails]", e);
    return { message: "We couldn't save your details. Please try again.", values };
  }
  return { ok: true, message: "Saved.", values };
}

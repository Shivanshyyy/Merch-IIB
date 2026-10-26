"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction } from "@/lib/admin/guard";
import { authBackend } from "@/lib/auth/backend";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/form-state";
import { passwordSchema, profileSchema } from "@/lib/schemas";

const text = (f: FormData, k: string) => String(f.get(k) ?? "");
const firstErrors = (error: z.ZodError) => Object.fromEntries(Object.entries(z.flattenError(error).fieldErrors).map(([k, v]) => [k, (v as string[])[0]]));

// Readable and easy to dictate over WhatsApp: no 0/O/1/l/I.
const PW_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const generatePassword = () => Array.from({ length: 10 }, () => PW_ALPHABET[randomInt(PW_ALPHABET.length)]).join("");

export async function updateCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  return adminAction(async () => {
    const id = text(formData, "id");
    const values = Object.fromEntries(["fullName", "phone", "rollNo", "defaultSize"].map((k) => [k, text(formData, k)]));
    if (!z.uuid().safeParse(id).success) return { ok: false, message: "Customer not found.", values };
    const parsed = profileSchema.safeParse(values);
    if (!parsed.success) return { ok: false, fieldErrors: firstErrors(parsed.error), values };
    try {
      await db().updateProfile(id, { full_name: parsed.data.fullName, phone: parsed.data.phone, roll_no: parsed.data.rollNo, default_size: parsed.data.defaultSize });
    } catch (e) {
      console.error("[admin updateCustomer]", e);
      return { ok: false, message: "Couldn't save the customer.", values };
    }
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Customer saved.", values };
  });
}

// Customers can't reset their own password (no email is ever sent), so the admin sets a new one.
export async function resetCustomerPassword(userId: string, custom?: string) {
  return adminAction(async () => {
    if (!z.uuid().safeParse(userId).success) return { ok: false as const, message: "Customer not found." };
    const chosen = custom?.trim();
    if (chosen) {
      const check = passwordSchema.safeParse(chosen);
      if (!check.success) return { ok: false as const, message: z.flattenError(check.error).formErrors[0] ?? "Invalid password." };
    }
    const password = chosen || generatePassword();
    try {
      await authBackend().setPassword(userId, password);
    } catch (e) {
      console.error("[admin resetCustomerPassword]", e);
      return { ok: false as const, message: "Couldn't reset the password." };
    }
    return { ok: true as const, message: "Password changed.", password };
  });
}

"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import type { Settings } from "@/config/site";
import { adminAction } from "@/lib/admin/guard";
import { settingsSchema } from "@/lib/admin/schemas";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/form-state";

const text = (f: FormData, k: string) => String(f.get(k) ?? "");
const num = (v: string) => (v.trim() === "" ? NaN : Number(v));
const firstErrors = (error: z.ZodError) => Object.fromEntries(Object.entries(z.flattenError(error).fieldErrors).map(([k, v]) => [k, (v as string[])[0]]));
const json = (v: string): unknown => {
  try {
    return JSON.parse(v);
  } catch {
    return undefined;
  }
};

export async function saveSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  return adminAction(async () => {
    const values = Object.fromEntries(["brand", "upiId", "payeeName", "contactName", "phone", "whatsapp", "pickupLocation", "pickupRoom", "pickupHours", "refundWindowDays", "nameMaxLength", "maxPendingOrdersPerEmail"].map((k) => [k, text(formData, k)]));

    const sizeChart = json(text(formData, "sizeChart"));
    const fabricSpecs = json(text(formData, "fabricSpecs"));
    if (sizeChart === undefined || fabricSpecs === undefined) return { ok: false, message: "The size chart or fabric specs couldn't be read. Reload and try again.", values };

    const parsed = settingsSchema.safeParse({
      ...values,
      phone: values.phone.replace(/\D/g, ""),
      whatsapp: values.whatsapp.replace(/\D/g, ""),
      refundWindowDays: num(values.refundWindowDays),
      nameMaxLength: num(values.nameMaxLength),
      maxPendingOrdersPerEmail: num(values.maxPendingOrdersPerEmail),
      nameUppercase: formData.get("nameUppercase") === "on",
      sizeChart,
      fabricSpecs,
    });
    if (!parsed.success) return { ok: false, fieldErrors: firstErrors(parsed.error), message: "Please fix the highlighted fields.", values };

    try {
      await db().saveSettings(parsed.data as Settings);
    } catch (e) {
      console.error("[admin saveSettings]", e);
      return { ok: false, message: "Couldn't save the settings.", values };
    }
    updateTag("settings"); // takes effect on the live site immediately
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Settings saved. They're live on the site now.", values };
  });
}

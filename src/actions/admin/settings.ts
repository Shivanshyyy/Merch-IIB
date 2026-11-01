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

const OFFER_LABEL: Record<string, string> = { comboPercent: "Combo %", bulkAbove: "Big order amount", bulkPercent: "Big order %" };
const PROMO_LABEL: Record<string, string> = { title: "Headline", limit: "Number of spots", items: "Freebies", note: "Small print" };

export async function saveSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  return adminAction(async () => {
    const values = Object.fromEntries(["brand", "upiId", "payeeName", "contactName", "phone", "whatsapp", "pickupLocation", "pickupRoom", "pickupHours", "refundWindowDays", "nameMaxLength", "maxPendingOrdersPerEmail", "promoTitle", "promoLimit", "promoItems", "promoNote", "offerCombo", "offerBulkAbove", "offerBulkPercent"].map((k) => [k, text(formData, k)]));

    values.promoEnabled = formData.get("promoEnabled") === "on" ? "on" : "";
    const sizeCharts = { hoodie: json(text(formData, "sizeChartHoodie")), tee: json(text(formData, "sizeChartTee")) };
    const fabricSpecs = json(text(formData, "fabricSpecs"));
    if (sizeCharts.hoodie === undefined || sizeCharts.tee === undefined || fabricSpecs === undefined) return { ok: false, message: "The size chart or fabric specs couldn't be read. Reload and try again.", values };

    const parsed = settingsSchema.safeParse({
      ...values,
      phone: values.phone.replace(/\D/g, ""),
      whatsapp: values.whatsapp.replace(/\D/g, ""),
      refundWindowDays: num(values.refundWindowDays),
      nameMaxLength: num(values.nameMaxLength),
      maxPendingOrdersPerEmail: num(values.maxPendingOrdersPerEmail),
      nameUppercase: formData.get("nameUppercase") === "on",
      sizeCharts,
      fabricSpecs,
      offers: { comboPercent: num(values.offerCombo), bulkAbove: num(values.offerBulkAbove), bulkPercent: num(values.offerBulkPercent) },
      promo: {
        enabled: values.promoEnabled === "on",
        limit: num(values.promoLimit),
        title: values.promoTitle,
        items: values.promoItems.split("\n").map((s) => s.trim()).filter(Boolean),
        note: values.promoNote,
      },
    });
    if (!parsed.success) {
      const fieldErrors = firstErrors(parsed.error);
      // Offer errors all show under the headline field, so say which part is wrong.
      const promoIssue = parsed.error.issues.find((i) => i.path[0] === "promo");
      const offerIssue = parsed.error.issues.find((i) => i.path[0] === "offers");
      if (offerIssue) fieldErrors.offers = `${OFFER_LABEL[String(offerIssue.path[1])] ?? "Discount"}: ${offerIssue.message}`;
      if (promoIssue) fieldErrors.promo = `${PROMO_LABEL[String(promoIssue.path[1])] ?? "Offer"}: ${promoIssue.message}`;
      return { ok: false, fieldErrors, message: "Please fix the highlighted fields.", values };
    }

    try {
      await db().saveSettings(parsed.data as Settings);
    } catch (e) {
      console.error("[admin saveSettings]", e);
      return { ok: false, message: "Couldn't save the settings.", values };
    }
    updateTag("settings"); // takes effect on the live site immediately
    updateTag("promo");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Settings saved. They're live on the site now.", values };
  });
}

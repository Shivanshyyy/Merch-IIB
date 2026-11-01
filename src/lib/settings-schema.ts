// Validation + merging for runtime settings. Client-safe (no server imports).
import { z } from "zod";
import { defaultSettings, type Settings } from "@/config/site";

const UPI_RE = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z][a-zA-Z0-9]{1,31}$/;
const phoneDigits = z.string().trim().regex(/^\d{10,15}$/, "Digits only, country code first (e.g. 919876543210)");

export const settingsSchema = z.object({
  brand: z.string().trim().min(1, "Required").max(40, "Too long"),
  upiId: z.string().trim().regex(UPI_RE, "Use the form name@bank"),
  payeeName: z.string().trim().min(1, "Required").max(60, "Too long"),
  contactName: z.string().trim().min(1, "Required").max(40, "Too long"),
  phone: phoneDigits,
  whatsapp: phoneDigits,
  pickupLocation: z.string().trim().min(1, "Required").max(60, "Too long"),
  pickupRoom: z.string().trim().min(1, "Required").max(40, "Too long"),
  pickupHours: z.string().trim().min(1, "Required").max(80, "Too long"),
  refundWindowDays: z.number().int("Whole days").min(0, "0 or more").max(90, "At most 90"),
  nameMaxLength: z.number().int("Whole number").min(1, "At least 1").max(30, "At most 30"),
  nameUppercase: z.boolean(),
  maxPendingOrdersPerEmail: z.number().int("Whole number").min(1, "At least 1").max(20, "At most 20"),
  sizeChart: z.object({
    unit: z.string().trim().min(1).max(8),
    columns: z.array(z.string().trim().min(1).max(20)).min(1).max(6),
    rows: z.record(z.string().max(8), z.array(z.string().trim().max(12)).max(6)),
  }),
  promo: z.object({
    enabled: z.boolean(),
    limit: z.number().int("Whole number").min(1, "At least 1").max(10000, "At most 10000"),
    title: z.string().trim().min(1, "Required").max(80, "Too long"),
    items: z.array(z.string().trim().min(1).max(40)).max(6, "At most 6 items"),
    note: z.string().trim().max(140, "Too long"),
  }),
  fabricSpecs: z.array(z.object({ label: z.string().trim().min(1).max(30), value: z.string().trim().min(1).max(40) })).max(8),
});

// Field by field, so one corrupt stored value falls back to its default instead of breaking the whole site.
export function mergeSettings(stored: unknown): Settings {
  const source = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
  const out: Record<string, unknown> = { ...defaultSettings };
  for (const key of Object.keys(settingsSchema.shape) as (keyof Settings)[]) {
    if (!(key in source)) continue;
    const parsed = settingsSchema.shape[key].safeParse(source[key]);
    if (parsed.success) out[key] = parsed.data;
  }
  return out as Settings;
}

export const isPlaceholderUpi = (upiId: string) => upiId === defaultSettings.upiId;

export type ChecklistItem = { key: string; label: string; done: boolean; hint: string };

// Values still on their placeholder. Drives the admin dashboard checklist and the pay-page production guard.
export function setupChecklist(s: Settings): ChecklistItem[] {
  const blank = (v: string) => v === "—" || v === "TBA" || v === "";
  return [
    { key: "upi", label: "UPI ID", done: !isPlaceholderUpi(s.upiId), hint: "Customers pay to this ID." },
    { key: "payee", label: "Payee name", done: s.payeeName !== defaultSettings.payeeName, hint: "Shown in the UPI app when paying." },
    { key: "phone", label: "Phone & WhatsApp", done: s.phone !== defaultSettings.phone && s.whatsapp !== defaultSettings.whatsapp, hint: "Where customers send payment screenshots." },
    { key: "pickup", label: "Pickup room & hours", done: !blank(s.pickupRoom) && !blank(s.pickupHours), hint: "Shown on the pay page and policies." },
    { key: "sizes", label: "Size chart", done: Object.values(s.sizeChart.rows).some((r) => r.some((c) => !blank(c))), hint: "Measurements for the size-chart popup." },
  ];
}

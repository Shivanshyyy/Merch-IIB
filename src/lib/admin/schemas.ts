// Admin form validation. Client-safe, so forms can validate inline with the exact rules the server applies.
import { z } from "zod";
import { settingsSchema } from "@/lib/settings-schema";

const hex = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB colour");

export const colorwaySchema = z.object({ name: z.string().trim().min(1, "Name the colourway").max(30, "Too long"), body: hex, stitch: hex });

export const parseSizes = (text: string) => [...new Set(text.split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean))];

export const productSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(60, "Too long"),
  slug: z.string().trim().toLowerCase().min(2, "At least 2 characters").max(60, "Too long").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, digits and dashes only"),
  type: z.enum(["hoodie", "tee"]),
  description: z.string().trim().max(400, "At most 400 characters"),
  price_inr: z.number({ error: "Enter a price" }).int("Whole rupees only").min(0, "Can't be negative").max(100000, "Too high"),
  sizes: z.array(z.string().regex(/^[A-Z0-9]{1,8}$/, "Sizes are 1–8 letters or digits")).min(1, "Add at least one size").max(10, "At most 10 sizes"),
  colorways: z
    .array(colorwaySchema)
    .min(1, "Add at least one colourway")
    .max(8, "At most 8 colourways")
    .refine((c) => new Set(c.map((x) => x.name.toLowerCase())).size === c.length, "Colourway names must be different"),
  personalizable: z.boolean(),
  active: z.boolean(),
  sort: z.number({ error: "Enter a number" }).int().min(0).max(999),
});

export const batchSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name").max(60, "Too long"),
    opens_at: z.string().min(1, "Pick an opening time"),
    closes_at: z.string().min(1, "Pick a cutoff"),
    est_delivery: z.string().trim().max(80, "Too long"),
  })
  .refine((b) => Date.parse(b.closes_at) > Date.parse(b.opens_at), { path: ["closes_at"], message: "The cutoff must be after it opens" });

export const BATCH_FLOW = ["open", "closed", "ordered", "received", "done"] as const;

export { settingsSchema };

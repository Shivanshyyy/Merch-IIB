import { z } from "zod";
import { site } from "@/config/site";
import { signUpSchema } from "@/lib/schemas";
import type { DesignInput } from "@/lib/types";
import { colourByName, GARMENT_COLOURS } from "./palette";

const UPI = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z][a-zA-Z0-9]+$/;

export const upiIdSchema = z
  .string()
  .trim()
  .max(60, "Too long")
  .refine((v) => v === "" || UPI.test(v), "Enter a UPI ID like name@bank")
  .transform((v) => v || null);

export const bioSchema = z
  .string()
  .trim()
  .max(300, "Keep it under 300 characters")
  .transform((v) => v || null);

const agree = z.boolean().refine((v) => v, "Please accept the designer terms");

const { fullName, email, phone, password } = signUpSchema.shape;

export const designerDetailsSchema = z.object({ bio: bioSchema, upiId: upiIdSchema });
export const designerApplySchema = z.object({ bio: bioSchema, upiId: upiIdSchema, agree });
export const designerSignUpSchema = z.object({ fullName, email, phone, password, bio: bioSchema, upiId: upiIdSchema, agree });

// ---- design details ----

const COLOUR_NAMES = GARMENT_COLOURS.map((c) => c.name) as [string, ...string[]];

const isHttps = (v: string) => {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
};

export const designSchema = z.object({
  title: z.string().trim().min(2, "Give the design a title").max(60, "Keep it under 60 characters"),
  description: z.string().trim().max(600, "Keep it under 600 characters"),
  productType: z.enum(["hoodie", "tee"], "Pick hoodie or tee"),
  colours: z
    .array(z.enum(COLOUR_NAMES, "Pick colours from the list"))
    .max(site.maxDesignColorways, `Pick up to ${site.maxDesignColorways} colours`)
    .transform((names) => [...new Set(names)]),
  suggestedPrice: z.string().trim().transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v);
    if (!/^\d+$/.test(v) || n < 100 || n > 9999) {
      ctx.addIssue({ code: "custom", message: "Whole rupees, from 100 to 9999" });
      return z.NEVER;
    }
    return n;
  }),
  printFileUrl: z
    .string()
    .trim()
    .max(300, "Too long")
    .refine((v) => v === "" || isHttps(v), "Use a full https:// link")
    .transform((v) => v || null),
  originality: z.boolean(),
});
export type DesignFields = z.output<typeof designSchema>;

export function toDesignInput(d: DesignFields): DesignInput {
  return {
    title: d.title,
    description: d.description,
    product_type: d.productType,
    colorways: d.colours.flatMap((n) => colourByName(n) ?? []),
    suggested_price_inr: d.suggestedPrice,
    print_file_url: d.printFileUrl,
  };
}

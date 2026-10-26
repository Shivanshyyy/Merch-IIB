// Shared by client forms and server actions, so both sides enforce identical rules.
import { z } from "zod";
import { site } from "@/config/site";

export const NAME_ALLOWED = /^[A-Za-z .'-]*$/;

export const normalizeName = (s: string) => {
  const t = s.replace(/\s+/g, " ").trim();
  return site.nameUppercase ? t.toUpperCase() : t;
};

const nameMsg = `Letters, spaces and . ' - only, up to ${site.nameMaxLength} characters`;

export const personalName = z
  .string()
  .max(60, nameMsg)
  .transform(normalizeName)
  .pipe(z.string().max(site.nameMaxLength, nameMsg).regex(NAME_ALLOWED, nameMsg));

export const cartLineSchema = z.object({
  slug: z.string().min(1).max(80),
  colorway: z.string().min(1).max(40),
  size: z.string().min(1).max(8),
  name: personalName,
  qty: z.number().int().min(1).max(site.maxQtyPerLine),
});
export type CartLineInput = z.input<typeof cartLineSchema>;

export const normalizePhone = (s: string) => s.replace(/[\s-]/g, "").replace(/^(\+?91|0)(?=\d{10}$)/, "");

export const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number"));

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

export const checkoutSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80, "Too long"),
  email: emailSchema,
  phone: phoneSchema,
  hostel: z.string().trim().min(1, "Which hostel are you in?").max(40, "Too long"),
  room: z.string().trim().min(1, "Enter your room number").max(20, "Too long"),
  confirmSpelling: z.literal(true, { error: "Please confirm the name spelling and sizes" }),
  confirmPolicy: z.literal(true, { error: "Please confirm you have read the policy" }),
  items: z.array(cartLineSchema).min(1, "Your cart is empty").max(20, "Too many items in one order"),
});

export type CheckoutField = "fullName" | "email" | "phone" | "hostel" | "room" | "confirmSpelling" | "confirmPolicy" | "items";

export const ORDER_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O/1/I/L
export const ORDER_CODE_LENGTH = 4;

// Accepts "hd7k4q", "HD 7K4Q" etc. and returns the canonical "HD-7K4Q", or the cleaned input if it can't fit.
export const normalizeOrderCode = (input: string) => {
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const prefix = site.orderCodePrefix;
  return clean.startsWith(prefix) ? `${prefix}-${clean.slice(prefix.length)}` : clean;
};

export const orderCodeSchema = z
  .string()
  .transform(normalizeOrderCode)
  .pipe(z.string().regex(new RegExp(`^${site.orderCodePrefix}-[${ORDER_CODE_ALPHABET}]{${ORDER_CODE_LENGTH}}$`), "That doesn't look like an order code, e.g. HD-7K4Q"));

export const trackSchema = z.object({ email: emailSchema, code: orderCodeSchema });

export const utrSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{8,22}$/, "A UTR is 8 to 22 letters and digits, with no spaces");

export type FieldErrors<F extends string> = Partial<Record<F, string>>;

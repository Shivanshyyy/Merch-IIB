// Shared by client forms and server actions, so both sides enforce identical rules.
import { z } from "zod";
import { site, type Settings } from "@/config/site";

export const NAME_ALLOWED = /^[A-Za-z .'-]*$/;

export type NameRules = Pick<Settings, "nameMaxLength" | "nameUppercase">;

export const normalizeName = (s: string, rules: Pick<Settings, "nameUppercase">) => {
  const t = s.replace(/\s+/g, " ").trim();
  return rules.nameUppercase ? t.toUpperCase() : t;
};

export function makeNameSchema(rules: NameRules) {
  const msg = `Letters, spaces and . ' - only, up to ${rules.nameMaxLength} characters`;
  return z
    .string()
    .max(60, msg)
    .transform((s) => normalizeName(s, rules))
    .pipe(z.string().max(rules.nameMaxLength, msg).regex(NAME_ALLOWED, msg));
}

export function makeCartLineSchema(rules: NameRules) {
  return z.object({
    slug: z.string().min(1).max(80),
    colorway: z.string().min(1).max(40),
    size: z.string().min(1).max(8),
    name: makeNameSchema(rules),
    qty: z.number().int().min(1).max(site.maxQtyPerLine),
  });
}
export type CartLineInput = { slug: string; colorway: string; size: string; name: string; qty: number };

export const normalizePhone = (s: string) => s.replace(/[\s-]/g, "").replace(/^(\+?91|0)(?=\d{10}$)/, "");

export const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number"));

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

const fullName = z.string().trim().min(2, "Enter your full name").max(80, "Too long");
const optionalText = (max: number, pattern?: RegExp, msg?: string) => {
  const base = z.string().trim().max(max, "Too long");
  return (pattern ? base.regex(pattern, msg) : base).transform((v) => v || null);
};

export const passwordSchema = z.string().min(8, "At least 8 characters").max(72, "At most 72 characters");

const profileFields = {
  fullName,
  phone: phoneSchema,
  rollNo: optionalText(20, /^[A-Za-z0-9/\- ]*$/, "Letters, digits, / and - only"),
  defaultSize: optionalText(8, /^[A-Za-z0-9]*$/, "e.g. M or XL").transform((v) => v?.toUpperCase() ?? null),
};
export const profileSchema = z.object(profileFields);
export const signUpSchema = z.object({ ...profileFields, email: emailSchema, password: passwordSchema });
export const logInSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password").max(72) });
export const changePasswordSchema = z.object({ current: z.string().min(1, "Enter your current password").max(72), next: passwordSchema });

export function makeCheckoutSchema(rules: NameRules) {
  return z.object({
    fullName,
    phone: phoneSchema,
    hostel: z.string().trim().min(1, "Which hostel are you in?").max(40, "Too long"),
    room: z.string().trim().min(1, "Enter your room number").max(20, "Too long"),
    confirmSpelling: z.literal(true, { error: "Please confirm the name spelling and sizes" }),
    confirmPolicy: z.literal(true, { error: "Please confirm you have read the policy" }),
    items: z.array(makeCartLineSchema(rules)).min(1, "Your cart is empty").max(20, "Too many items in one order"),
  });
}

export type CheckoutField = "fullName" | "phone" | "hostel" | "room" | "confirmSpelling" | "confirmPolicy" | "items";

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

export const utrSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{8,22}$/, "A UTR is 8 to 22 letters and digits, with no spaces");

export type FieldErrors<F extends string> = Partial<Record<F, string>>;

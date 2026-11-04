import { z } from "zod";
import { signUpSchema } from "@/lib/schemas";

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

import type { CheckoutField, FieldErrors } from "@/lib/schemas";
import type { Order } from "@/lib/types";

export type CheckoutState = {
  ok: boolean;
  code?: string;
  message?: string;
  fieldErrors?: FieldErrors<CheckoutField>;
  values?: Record<string, string>;
};

export type UtrState = { ok: boolean; message?: string; error?: string };

// Shared by login, sign-up, profile and password forms.
export type FormState = {
  ok?: boolean;
  id?: string; // set when a form created a record
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

// What customers see of their orders: no phone, UTR or admin notes.
export type OrderView = Pick<Order, "code" | "items" | "total_inr" | "discount_inr" | "discount_label" | "payment_status" | "order_status" | "refund_status" | "verified_at" | "created_at">;

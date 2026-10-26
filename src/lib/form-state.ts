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

// What /track may reveal: no phone, no UTR, no admin notes.
export type TrackedOrder = Pick<Order, "code" | "items" | "total_inr" | "payment_status" | "order_status" | "refund_status" | "verified_at" | "created_at">;

export type TrackState = { ok: boolean; orders?: TrackedOrder[]; error?: string; fieldErrors?: { email?: string; code?: string } };

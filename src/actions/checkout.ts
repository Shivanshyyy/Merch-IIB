"use server";

import { getSessionUser } from "@/lib/auth/session";
import type { CheckoutState } from "@/lib/form-state";
import { placeOrderFor } from "@/lib/orders/place-order";

const text = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function placeOrder(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const values = { fullName: text(formData, "fullName"), phone: text(formData, "phone"), hostel: text(formData, "hostel"), room: text(formData, "room") };

  // Honeypot: real users never see this field. Answer like a generic failure so bots learn nothing.
  if (text(formData, "fax")) return { ok: false, message: "Something went wrong. Please try again.", values };

  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Please log in to place your order. Your cart will be waiting.", values };

  let items: unknown = [];
  try {
    items = JSON.parse(text(formData, "items") || "[]");
  } catch {
    return { ok: false, message: "Your cart couldn't be read. Please refresh and try again.", values };
  }

  return placeOrderFor(user, { values, items, confirmSpelling: formData.get("confirmSpelling") === "on", confirmPolicy: formData.get("confirmPolicy") === "on" });
}

"use server";

import { getSessionUser } from "@/lib/auth/session";
import type { UtrState } from "@/lib/form-state";
import { saveUtrFor } from "@/lib/orders/save-utr";

export async function submitUtr(_prev: UtrState, formData: FormData): Promise<UtrState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please log in again to save your UTR." };
  return saveUtrFor(user, String(formData.get("code") ?? ""), String(formData.get("utr") ?? ""));
}

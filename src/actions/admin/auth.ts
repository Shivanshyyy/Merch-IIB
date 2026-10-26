"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminConfig, ADMIN_COOKIE, ADMIN_MAX_AGE, safeAdminNext, signAdminToken } from "@/lib/admin/token";
import { clearFailures, recordFailure, throttleStatus } from "@/lib/admin/throttle";
import type { FormState } from "@/lib/form-state";

const digest = (s: string) => createHash("sha256").update(s).digest();
const safeEqual = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));
const clientIp = (h: Headers) => h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";

export async function adminLogin(_prev: FormState, formData: FormData): Promise<FormState> {
  const cfg = adminConfig();
  if (!cfg.ready) return { message: "The admin panel isn't set up yet: ADMIN_PASSWORD and ADMIN_SESSION_SECRET (32+ characters) must be set." };

  const h = await headers();
  const ip = clientIp(h);
  const gate = throttleStatus(ip);
  if (gate.blocked) return { message: `Too many wrong attempts. Try again in ${gate.retryInMinutes} minute${gate.retryInMinutes === 1 ? "" : "s"}.` };

  if (!safeEqual(String(formData.get("password") ?? ""), cfg.password)) {
    recordFailure(ip);
    await new Promise((r) => setTimeout(r, 600));
    return { fieldErrors: { password: "That isn't the admin password." } };
  }

  clearFailures(ip);
  const token = await signAdminToken();
  if (!token) return { message: "Couldn't start a session." };
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: h.get("x-forwarded-proto") === "https",
    path: "/admin", // never sent to the public site
    maxAge: ADMIN_MAX_AGE,
  });
  redirect(safeAdminNext(String(formData.get("next") ?? "")));
}

export async function adminLogout() {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
  redirect("/admin/login");
}

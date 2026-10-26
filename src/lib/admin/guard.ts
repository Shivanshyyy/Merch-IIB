import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAdminToken } from "./token";

export const isAdmin = async () => verifyAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);

// For pages and layouts: send a logged-out visitor to the login screen.
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

type Result = { ok: boolean; message?: string };

// Every admin server action goes through this, so no action can run without a valid admin cookie.
export async function adminAction<T extends Result>(run: () => Promise<T>): Promise<T | { ok: false; message: string }> {
  if (!(await isAdmin())) return { ok: false, message: "Your admin session has expired. Log in again." };
  return run();
}

// Admin session token: a signed JWT in an httpOnly cookie. Used by proxy.ts, server actions and route handlers.
import { jwtVerify, SignJWT } from "jose";

export const ADMIN_COOKIE = "admin_session";
export const ADMIN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

const DEV_SECRET = "dev-only-admin-session-secret-change-me-0123456789";
const enc = (s: string) => new TextEncoder().encode(s);

export type AdminConfig = { ready: true; password: string; secret: Uint8Array; demo: boolean } | { ready: false };

// In production both env vars are required. Anywhere else the panel works out of the box with password "admin".
export function adminConfig(): AdminConfig {
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (password && secret && secret.length >= 32) return { ready: true, password, secret: enc(secret), demo: false };
  if (process.env.VERCEL_ENV === "production") return { ready: false };
  return { ready: true, password: password ?? "admin", secret: enc(secret && secret.length >= 32 ? secret : DEV_SECRET), demo: !password };
}

export async function signAdminToken(): Promise<string | null> {
  const cfg = adminConfig();
  if (!cfg.ready) return null;
  return new SignJWT({ role: "admin" }).setProtectedHeader({ alg: "HS256" }).setSubject("admin").setIssuedAt().setExpirationTime(`${ADMIN_MAX_AGE}s`).sign(cfg.secret);
}

export async function verifyAdminToken(token: string | undefined): Promise<boolean> {
  const cfg = adminConfig();
  if (!token || !cfg.ready) return false;
  try {
    const { payload } = await jwtVerify(token, cfg.secret, { algorithms: ["HS256"] });
    return payload.role === "admin";
  } catch {
    return false;
  }
}

// Only paths inside the admin panel may be used as a post-login destination.
export function safeAdminNext(value: string | null | undefined) {
  return value && value.startsWith("/admin") && !value.startsWith("/admin/login") && !value.includes("//") ? value : "/admin";
}

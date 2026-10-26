import "server-only";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import type { AuthBackend, SessionUser } from "./types";

// Local stand-in for Supabase Auth when no keys are set. Never active on the live site (see mode.ts).
const COOKIE = "merch_demo_session";
const secret = new TextEncoder().encode("demo-only-secret-never-used-in-production-0000");

type DemoUser = { id: string; email: string; name: string; salt: string; hash: string };
const g = globalThis as unknown as { __merchDemoUsers?: Map<string, DemoUser> };
const users = () => (g.__merchDemoUsers ??= new Map<string, DemoUser>());

const hashPassword = (password: string, salt: string) => scryptSync(password, salt, 32).toString("hex");
const matches = (u: DemoUser, password: string) => {
  const a = Buffer.from(hashPassword(password, u.salt), "hex");
  const b = Buffer.from(u.hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};

async function startSession(u: DemoUser) {
  const token = await new SignJWT({ email: u.email }).setProtectedHeader({ alg: "HS256" }).setSubject(u.id).setExpirationTime("7d").sign(secret);
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 24 * 3600 });
}

export const demoBackend: AuthBackend = {
  async createUser(email, password, meta) {
    if (users().has(email)) return { error: "exists" };
    const salt = randomBytes(16).toString("hex");
    const user: DemoUser = { id: randomUUID(), email, name: meta.fullName, salt, hash: hashPassword(password, salt) };
    users().set(email, user);
    return { id: user.id };
  },

  async deleteUser(id) {
    for (const [email, u] of users()) if (u.id === id) users().delete(email);
  },

  async signIn(email, password) {
    const u = users().get(email);
    if (!u || !matches(u, password)) return { error: "invalid" };
    await startSession(u);
    return { id: u.id, email: u.email };
  },

  async checkPassword(email, password) {
    const u = users().get(email);
    return !!u && matches(u, password);
  },

  async signOut() {
    (await cookies()).delete(COOKIE);
  },

  async currentUser(): Promise<SessionUser | null> {
    const token = (await cookies()).get(COOKIE)?.value;
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, secret);
      const u = [...users().values()].find((x) => x.id === payload.sub);
      return u ? { id: u.id, email: u.email, name: u.name } : null; // a restart wipes demo users: treat as logged out
    } catch {
      return null;
    }
  },

  async setPassword(userId, password) {
    const u = [...users().values()].find((x) => x.id === userId);
    if (!u) return;
    u.salt = randomBytes(16).toString("hex");
    u.hash = hashPassword(password, u.salt);
  },
};

import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import type { Database } from "@/lib/db/database.types";
import { serviceClient } from "@/lib/db/supabase-client";
import type { AuthBackend, SessionUser } from "./types";

const env = () => {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required for login");
  return { url, anon };
};

// Per-request client that keeps the session in cookies. Create a new one each time, never share.
async function supabaseServer() {
  const { url, anon } = env();
  const store = await cookies();
  const https = (await headers()).get("x-forwarded-proto") === "https";
  return createServerClient<Database>(url, anon, {
    cookieOptions: { sameSite: "lax", secure: https, httpOnly: true }, // only server code talks to Auth, so the browser never needs to read it
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called while rendering a Server Component, where cookies are read-only. proxy.ts refreshes sessions.
        }
      },
    },
  });
}

const isDuplicate = (e: { status?: number; code?: string; message: string }) => e.code === "email_exists" || e.code === "user_already_exists" || e.status === 422 || /already.*registered|already exists/i.test(e.message);

export const supabaseBackend: AuthBackend = {
  async createUser(email, password, meta) {
    // The admin API creates a confirmed user and sends no email, whatever the project's "Confirm email" setting says.
    const { data, error } = await serviceClient().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: meta.fullName } });
    if (error || !data.user) return { error: error && isDuplicate(error) ? "exists" : "failed" };
    return { id: data.user.id };
  },

  async deleteUser(id) {
    await serviceClient().auth.admin.deleteUser(id);
  },

  async signIn(email, password) {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { error: error && (error.code === "invalid_credentials" || error.status === 400) ? "invalid" : "failed" };
    return { id: data.user.id, email: data.user.email ?? email };
  },

  async checkPassword(email, password) {
    const { url, anon } = env();
    const probe = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await probe.auth.signInWithPassword({ email, password });
    return !error && !!data.user;
  },

  async signOut() {
    const sb = await supabaseServer();
    await sb.auth.signOut();
  },

  async currentUser(): Promise<SessionUser | null> {
    const sb = await supabaseServer();
    // Verifies the JWT signature (locally when the project uses asymmetric keys) rather than trusting the cookie blindly.
    const { data, error } = await sb.auth.getClaims();
    const claims = data?.claims;
    if (error || !claims?.sub || typeof claims.email !== "string") return null;
    const meta = (claims.user_metadata ?? {}) as { full_name?: unknown };
    return { id: claims.sub, email: claims.email, name: typeof meta.full_name === "string" ? meta.full_name : null };
  },

  async setPassword(userId, password) {
    const { error } = await serviceClient().auth.admin.updateUserById(userId, { password });
    if (error) throw new Error(`supabase setPassword: ${error.message}`);
  },
};

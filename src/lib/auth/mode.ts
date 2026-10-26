export type AuthMode = "supabase" | "demo" | "unconfigured";

// supabase: all three keys present. demo: no Supabase env at all, and not the live site.
// Anything in between (a real DB with no anon key, or production without keys) is a setup error, never a silent fallback.
export function authMode(): AuthMode {
  const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: svc } = process.env;
  if (url && anon && svc) return "supabase";
  if (url || anon || svc || process.env.VERCEL_ENV === "production") return "unconfigured";
  return "demo";
}

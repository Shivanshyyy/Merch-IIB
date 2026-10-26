import "server-only";
import { demoBackend } from "./demo";
import { authMode } from "./mode";
import { supabaseBackend } from "./supabase";
import type { AuthBackend } from "./types";

export function authBackend(): AuthBackend {
  switch (authMode()) {
    case "supabase":
      return supabaseBackend;
    case "demo":
      return demoBackend;
    default:
      throw new Error("Login isn't configured: set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY");
  }
}

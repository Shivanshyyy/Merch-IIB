import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type ServiceClient = ReturnType<typeof createServiceClient>;

// The service-role key bypasses RLS and can manage auth users: it must never reach client code.
export function createServiceClient(url: string, serviceKey: string) {
  return createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

let shared: ServiceClient | undefined;

export function serviceClient(): ServiceClient {
  if (shared) return shared;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  shared = createServiceClient(url, key);
  return shared;
}

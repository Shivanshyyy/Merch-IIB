import "server-only";
import { createMemoryDb } from "./memory";
import { createSupabaseDb } from "./supabase";
import { serviceClient } from "./supabase-client";
import type { Db } from "./types";

let instance: Db | undefined;

export function db(): Db {
  if (instance) return instance;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && key) {
    instance = createSupabaseDb(serviceClient());
  } else if (process.env.VERCEL_ENV === "production") {
    // Never fall back to the demo store on the live site: orders would silently vanish.
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in production");
  } else {
    console.warn("[db] Supabase env vars not set: using the in-memory DEMO store (data resets on restart).");
    instance = createMemoryDb();
  }
  return instance;
}

export { CodeTakenError, EmailTakenError, NotFoundError, SlugTakenError } from "./types";

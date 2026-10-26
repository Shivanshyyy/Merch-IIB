import "server-only";
import { cache } from "react";
import { authBackend } from "./backend";
import { rethrowNextSignals } from "@/lib/rethrow";
import { authMode } from "./mode";
import type { SessionUser } from "./types";

// One lookup per request, however many components ask. (Redirecting guards live in guards.ts.)
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (authMode() === "unconfigured") return null;
  try {
    return await authBackend().currentUser();
  } catch (e) {
    rethrowNextSignals(e);
    console.error("[auth] session lookup failed:", e);
    return null;
  }
});

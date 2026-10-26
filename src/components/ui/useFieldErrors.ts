"use client";

import { useState, type FocusEvent } from "react";
import type { z } from "zod";

// Inline validation shared by every form. The user's live result wins once they've touched a field, and a new
// server response starts clean, so a message never lingers under a value they already fixed.
export function useFieldErrors(serverState: unknown, serverErrors?: Record<string, string | undefined>) {
  const [client, setClient] = useState<{ at: unknown; errors: Record<string, string | undefined> }>({ at: null, errors: {} });
  const live = client.at === serverState ? client.errors : {};

  const set = (key: string, message: string | undefined) => setClient((c) => ({ at: serverState, errors: { ...(c.at === serverState ? c.errors : {}), [key]: message } }));
  const error = (key: string) => (key in live ? live[key] : serverErrors?.[key]);
  const validate = (key: string, schema: z.ZodType) => (e: FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const r = schema.safeParse(e.target.value);
    set(key, r.success ? undefined : r.error.issues[0]?.message);
  };
  return { error, set, validate };
}

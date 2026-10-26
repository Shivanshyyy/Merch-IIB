"use client";

import { useActionState, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { lookupOrders } from "@/actions/orders";
import { OrderCard } from "@/components/track/OrderCard";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { site } from "@/config/site";
import type { TrackState } from "@/lib/form-state";

const KEY = "merch-track";

const noopSubscribe = () => () => {};
const readSaved = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return ""; // private mode
  }
};

export function TrackForm() {
  const [state, action] = useActionState<TrackState, FormData>(lookupOrders, { ok: false });
  // Prefill from the last lookup (or the order just placed at checkout). Server snapshot is empty so SSR matches.
  const savedRaw = useSyncExternalStore(noopSubscribe, readSaved, () => "");
  const saved = useMemo(() => {
    try {
      return (JSON.parse(savedRaw || "null") as { email?: string; code?: string } | null) ?? {};
    } catch {
      return {};
    }
  }, [savedRaw]);
  const [typedEmail, setEmail] = useState<string | null>(null);
  const [typedCode, setCode] = useState<string | null>(null);
  const email = typedEmail ?? saved.email ?? "";
  const code = typedCode ?? saved.code ?? "";
  const remembered = Boolean(saved.email || saved.code);

  useEffect(() => {
    if (!state.ok) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ email, code }));
    } catch {
      /* private mode */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save once per successful lookup
  }, [state]);

  return (
    <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-16">
      <form action={action} noValidate className="grid h-fit content-start gap-5 border border-line bg-bg-2 p-6 lg:sticky lg:top-[calc(var(--nav-h)+24px)]">
        <p className="label">[ Look up ]</p>
        <TextField
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={state.fieldErrors?.email}
          help="The email you ordered with"
          required
        />
        <TextField
          label="Order code"
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={`${site.orderCodePrefix}-7K4Q`}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          error={state.fieldErrors?.code}
          help="Any one of your order codes. We'll show all your orders."
          required
        />
        <SubmitButton block size="lg">
          Check status
        </SubmitButton>
        {remembered && !state.ok && <p className="label normal-case tracking-normal">Filled in from your last visit.</p>}
        {state.error && (
          <p role="alert" className="border border-accent p-3 text-[0.9rem] text-[#ff7a63]">
            {state.error}
          </p>
        )}
      </form>

      <section aria-live="polite" aria-label="Your orders" className="min-w-0">
        {state.ok && state.orders ? (
          <div className="grid gap-8">
            <p className="label">
              [ {state.orders.length} {state.orders.length === 1 ? "order" : "orders"} ] — newest first
            </p>
            {state.orders.map((o) => (
              <OrderCard key={o.code} order={o} />
            ))}
          </div>
        ) : (
          <div className="flex h-full min-h-72 flex-col items-center justify-center gap-5 border border-dashed border-line px-6 py-16 text-center">
            <svg width="96" height="64" viewBox="0 0 96 64" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted" aria-hidden>
              <circle cx="14" cy="32" r="6" />
              <circle cx="48" cy="32" r="6" strokeDasharray="2 3" />
              <circle cx="82" cy="32" r="6" strokeDasharray="2 3" />
              <path d="M20 32h22M54 32h22" strokeDasharray="3 4" />
            </svg>
            <div>
              <p className="t-display text-xl">No orders on screen</p>
              <p className="mx-auto mt-3 max-w-sm text-muted">Enter your email and an order code to see every order on that email, from payment to pickup.</p>
            </div>
            <Button href="/shop" variant="ghost">
              Browse the drop
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

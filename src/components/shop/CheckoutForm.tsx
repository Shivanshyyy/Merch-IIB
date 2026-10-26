"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { placeOrder } from "@/actions/checkout";
import { Button } from "@/components/ui/Button";
import { Check } from "@/components/ui/Check";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { site } from "@/config/site";
import { colorwayImage, fmtDate, inr } from "@/lib/format";
import type { CheckoutState } from "@/lib/form-state";
import { checkoutSchema, type CheckoutField, type FieldErrors } from "@/lib/schemas";
import { useBatchClosed } from "@/lib/useBatchClosed";
import { cartCount, useCart } from "@/store/cart";

type FieldKey = "fullName" | "email" | "phone" | "hostel" | "room";
const LAST_LOOKUP_KEY = "merch-track";

export function CheckoutForm({ prices, batch }: { prices: Record<string, number>; batch: { name: string; closesAt: string } | null }) {
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const hydrated = useCart((s) => s.hydrated);
  const clear = useCart((s) => s.clear);
  const [state, action] = useActionState<CheckoutState, FormData>(placeOrder, { ok: false });
  // Client-side results are tied to the server state they were made against, so a fresh submit starts clean.
  const [client, setClient] = useState<{ at: CheckoutState | null; errors: FieldErrors<CheckoutField> }>({ at: null, errors: {} });
  const clientErrors = client.at === state ? client.errors : {};
  const setField = (key: CheckoutField, message: string | undefined) => setClient((c) => ({ at: state, errors: { ...(c.at === state ? c.errors : {}), [key]: message } }));
  const closed = useBatchClosed(batch?.closesAt) || !batch;

  // Show server-side prices, so a stale cart snapshot can't mislead.
  const priced = lines.map((l) => ({ ...l, unit: prices[l.slug], gone: prices[l.slug] === undefined }));
  const hasGone = priced.some((l) => l.gone);
  const changed = priced.some((l) => !l.gone && l.unit !== l.unitPriceInr);
  const total = priced.reduce((n, l) => n + (l.gone ? 0 : l.unit * l.qty), 0);

  useEffect(() => {
    if (!state.ok || !state.code) return;
    try {
      // Pre-fill /track with this order, since there is no login.
      localStorage.setItem(LAST_LOOKUP_KEY, JSON.stringify({ email: state.values?.email?.trim().toLowerCase() ?? "", code: state.code }));
    } catch {
      /* private mode */
    }
    clear();
    router.push(`/order/${state.code}/pay`);
  }, [state, clear, router]);

  const validate = (key: FieldKey) => (e: React.FocusEvent<HTMLInputElement>) => {
    const r = checkoutSchema.shape[key].safeParse(e.target.value);
    setField(key, r.success ? undefined : r.error.issues[0]?.message);
  };
  // Once the user has touched a field, their live result wins over the server's older message.
  const err = (k: CheckoutField) => (k in clientErrors ? clientErrors[k] : state.fieldErrors?.[k]);
  const v = (k: FieldKey) => state.values?.[k];

  if (hydrated && lines.length === 0 && !state.ok) {
    return (
      <div className="mt-12 border border-dashed border-line px-6 py-20 text-center">
        <p className="t-display text-2xl">Nothing to check out</p>
        <p className="mx-auto mt-3 max-w-sm text-muted">Your cart is empty. Add a hoodie first.</p>
        <Button href="/shop" size="lg" className="mt-8">
          Browse the drop
        </Button>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16">
      <input type="hidden" name="items" value={JSON.stringify(lines.map((l) => ({ slug: l.slug, colorway: l.colorway, size: l.size, name: l.name, qty: l.qty })))} />
      {/* Honeypot: invisible to people, tempting to bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Fax
          <input name="fax" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid content-start gap-10">
        <fieldset className="grid gap-5">
          <legend className="label mb-5">[ 01 ] — Who&apos;s it for</legend>
          <TextField label="Full name" name="fullName" autoComplete="name" defaultValue={v("fullName")} error={err("fullName")} onBlur={validate("fullName")} required />
          <TextField
            label="Email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            defaultValue={v("email")}
            error={err("email")}
            onBlur={validate("email")}
            help="This is how you track your order. There's no login."
            required
          />
          <TextField label="Phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} defaultValue={v("phone")} error={err("phone")} onBlur={validate("phone")} help="10-digit Indian mobile number" required />
        </fieldset>

        <fieldset className="grid gap-5 sm:grid-cols-2">
          <legend className="label mb-5">[ 02 ] — Pickup details</legend>
          <TextField label="Hostel" name="hostel" autoComplete="off" defaultValue={v("hostel")} error={err("hostel")} onBlur={validate("hostel")} placeholder="e.g. Hostel 4" required />
          <TextField label="Room" name="room" autoComplete="off" defaultValue={v("room")} error={err("room")} onBlur={validate("room")} required />
          <p className="label normal-case tracking-normal sm:col-span-2">
            You&apos;ll collect from {site.pickup.location}, Room {site.pickup.room}.
          </p>
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="label mb-3">[ 03 ] — Before you pay</legend>
          <Check name="confirmSpelling" label="I confirmed the name spelling and sizes" error={err("confirmSpelling")} onChange={(e) => setField("confirmSpelling", e.target.checked ? undefined : "Please confirm the name spelling and sizes")} />
          <Check
            name="confirmPolicy"
            label={
              <>
                I&apos;ve read the{" "}
                <Link href="/policies" target="_blank" className="underline underline-offset-4 hover:text-accent-2">
                  refund &amp; pickup policy
                </Link>
              </>
            }
            error={err("confirmPolicy")}
            onChange={(e) => setField("confirmPolicy", e.target.checked ? undefined : "Please confirm you have read the policy")}
          />
        </fieldset>
      </div>

      <aside className="h-fit border border-line bg-bg-2 p-6 lg:sticky lg:top-[calc(var(--nav-h)+24px)]">
        <p className="label">[ Your order ] — {hydrated ? cartCount(lines) : 0} items</p>
        <ul className="mt-5 grid gap-4">
          {priced.map((l) => (
            <li key={l.id} className="flex gap-3">
              <div className="relative size-16 shrink-0 bg-bg">
                <Image src={colorwayImage(l.slug, l.colorway)} alt="" fill sizes="64px" className="object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.9rem] font-medium">{l.productName}</p>
                <p className="label mt-1">
                  {l.colorway} · {l.size} · ×{l.qty}
                </p>
                {l.name && <p className="mono mt-1 text-[0.75rem] text-accent-2">{l.name}</p>}
                {l.gone && <p className="field-error">No longer available. Remove it from your cart.</p>}
              </div>
              <p className="mono text-[0.9rem]">{l.gone ? "—" : inr(l.unit * l.qty)}</p>
            </li>
          ))}
        </ul>
        {changed && <p className="label mt-4 normal-case tracking-normal text-accent-2">Prices were updated since you added these items. The total below is current.</p>}

        <div className="mt-6 flex items-baseline justify-between border-t border-line pt-5">
          <span className="label">Total</span>
          <span className="mono text-3xl">{inr(total)}</span>
        </div>
        {batch && <p className="label mt-3 normal-case tracking-normal">{batch.name} closes {fmtDate(batch.closesAt)}</p>}

        {state.message && (
          <p role="alert" className="mt-5 border border-accent p-4 text-[0.9rem] text-[#ff7a63]">
            {state.message}
          </p>
        )}
        {err("items") && (
          <p role="alert" className="field-error">
            {err("items")}
          </p>
        )}
        {state.ok && <p className="label mt-5 text-accent-2">Order placed. Taking you to payment…</p>}

        <SubmitButton size="lg" block className="mt-6" disabled={closed || hasGone || lines.length === 0 || state.ok}>
          {closed ? "Preorders closed" : `Place order · ${inr(total)}`}
        </SubmitButton>
        <p className="label mt-4 normal-case leading-relaxed tracking-normal">You pay by UPI on the next screen. Your order is held as &ldquo;payment pending&rdquo; until {site.contact.name} verifies it.</p>
      </aside>
    </form>
  );
}

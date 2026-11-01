"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo } from "react";
import { placeOrder } from "@/actions/checkout";
import { useSettings } from "@/components/SettingsProvider";
import { Button } from "@/components/ui/Button";
import { Check } from "@/components/ui/Check";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { useFieldErrors } from "@/components/ui/useFieldErrors";
import { ColorwayImage } from "@/components/shop/ColorwayImage";
import { fmtDate, inr } from "@/lib/format";
import type { CheckoutState } from "@/lib/form-state";
import { bestDiscount, offerHint, unitPrice, type ProductKind } from "@/lib/offers";
import { makeCheckoutSchema } from "@/lib/schemas";
import { useBatchClosed } from "@/lib/useBatchClosed";
import { cartCount, useCart } from "@/store/cart";

type Defaults = { fullName: string; phone: string; hostel: string; room: string };
type FieldKey = keyof Defaults;

type Props = {
  catalog: Record<string, { price_inr: number; name_fee_inr: number; type: ProductKind }>;
  batch: { name: string; closesAt: string } | null;
  email: string;
  defaults: Defaults;
};

export function CheckoutForm({ catalog, batch, email, defaults }: Props) {
  const router = useRouter();
  const settings = useSettings();
  const schema = useMemo(() => makeCheckoutSchema(settings), [settings]);
  const lines = useCart((s) => s.lines);
  const hydrated = useCart((s) => s.hydrated);
  const clear = useCart((s) => s.clear);
  const [state, action] = useActionState<CheckoutState, FormData>(placeOrder, { ok: false });
  const f = useFieldErrors(state, state.fieldErrors);
  const closed = useBatchClosed(batch?.closesAt) || !batch;

  // Show server-side prices, so a stale cart snapshot can't mislead.
  const priced = lines.map((l) => {
    const p = catalog[l.slug];
    return { ...l, unit: p ? unitPrice(p, l.name) : 0, kind: p?.type, gone: !p };
  });
  const hasGone = priced.some((l) => l.gone);
  const changed = priced.some((l) => !l.gone && l.unit !== l.unitPriceInr);
  const subtotal = priced.reduce((n, l) => n + l.unit * l.qty, 0);
  const discount = bestDiscount(priced.map((l) => ({ kind: l.kind, amount: l.unit * l.qty })), settings.offers);
  const total = subtotal - (discount?.amount ?? 0);
  const hint = offerHint(subtotal, discount, settings.offers);

  useEffect(() => {
    if (!state.ok || !state.code) return;
    clear();
    router.push(`/order/${state.code}/pay`);
  }, [state, clear, router]);

  const value = (k: FieldKey) => state.values?.[k] ?? defaults[k];
  const field = (k: FieldKey) => ({
    name: k,
    defaultValue: value(k),
    error: f.error(k),
    onBlur: f.validate(k, schema.shape[k]),
    required: true,
  });

  if (hydrated && lines.length === 0 && !state.ok) {
    return (
      <div className="mt-12 border border-dashed border-line px-6 py-20 text-center">
        <p className="t-display text-2xl">Nothing to check out</p>
        <p className="mx-auto mt-3 max-w-sm text-muted">Your cart is empty. Pick something from the drop first.</p>
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
        <fieldset className="grid gap-2">
          <legend className="label mb-5">[ 01 ] — Who&apos;s it for</legend>
          <TextField label="Full name" autoComplete="name" {...field("fullName")} />
          <TextField label="Email" value={email} readOnly aria-readonly help={
            <>
              Your account email.{" "}
              <Link href="/account" className="underline underline-offset-4 hover:text-fg">
                Edit your details
              </Link>
            </>
          } />
          <TextField label="Phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} help="10-digit Indian mobile number" {...field("phone")} />
        </fieldset>

        <fieldset className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
          <legend className="label mb-5">[ 02 ] — Pickup details</legend>
          <TextField label="Hostel" autoComplete="off" placeholder="e.g. Hostel 4" {...field("hostel")} />
          <TextField label="Room" autoComplete="off" {...field("room")} />
          <p className="label normal-case tracking-normal sm:col-span-2">
            You&apos;ll collect from {settings.pickupLocation}, {settings.pickupRoom}.
          </p>
        </fieldset>

        <fieldset className="grid gap-1">
          <legend className="label mb-3">[ 03 ] — Before you pay</legend>
          <Check
            name="confirmSpelling"
            label="I confirmed the name spelling and sizes"
            error={f.error("confirmSpelling")}
            onChange={(e) => f.set("confirmSpelling", e.target.checked ? undefined : "Please confirm the name spelling and sizes")}
          />
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
            error={f.error("confirmPolicy")}
            onChange={(e) => f.set("confirmPolicy", e.target.checked ? undefined : "Please confirm you have read the policy")}
          />
        </fieldset>
      </div>

      <aside className="h-fit border border-line bg-bg-2 p-6 lg:sticky lg:top-[calc(var(--nav-h)+24px)]">
        <p className="label">[ Your order ] — {hydrated ? cartCount(lines) : 0} items</p>
        <ul className="mt-5 grid gap-4">
          {priced.map((l) => (
            <li key={l.id} className="flex gap-3">
              <div className="relative size-16 shrink-0 bg-bg">
                <ColorwayImage slug={l.slug} colorway={l.colorway} body={l.colorwayBody} alt="" sizes="64px" />
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

        {discount && (
          <dl className="mono mt-6 grid gap-2 border-t border-line pt-5 text-[0.9rem]">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd>{inr(subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-accent-2">
              <dt>{discount.label}</dt>
              <dd className="shrink-0">−{inr(discount.amount)}</dd>
            </div>
          </dl>
        )}
        <div className={`flex items-baseline justify-between ${discount ? "mt-3" : "mt-6 border-t border-line pt-5"}`}>
          <span className="label">Total</span>
          <span className="mono text-3xl">{inr(total)}</span>
        </div>
        {hint && (
          <p className="label mt-3 normal-case tracking-normal text-accent-2">
            ✦ {hint}.{" "}
            <Link href="/shop" className="underline underline-offset-4">
              Keep shopping
            </Link>
          </p>
        )}
        {batch && (
          <p className="label mt-3 normal-case tracking-normal">
            {batch.name} closes {fmtDate(batch.closesAt)}
          </p>
        )}

        {state.message && (
          <p role="alert" className="mt-5 border border-accent p-4 text-[0.9rem] text-[#ff7a63]">
            {state.message}
          </p>
        )}
        {f.error("items") && (
          <p role="alert" className="field-error">
            {f.error("items")}
          </p>
        )}
        {state.ok && <p className="label mt-5 text-accent-2">Order placed. Taking you to payment…</p>}

        <SubmitButton size="lg" block className="mt-6" disabled={closed || hasGone || lines.length === 0 || state.ok}>
          {closed ? "Preorders closed" : `Place order · ${inr(total)}`}
        </SubmitButton>
        <p className="label mt-4 normal-case leading-relaxed tracking-normal">
          You pay by UPI on the next screen. Your order is held as &ldquo;payment pending&rdquo; until {settings.contactName} verifies it.
        </p>
      </aside>
    </form>
  );
}

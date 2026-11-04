"use client";

import { useActionState, useEffect, useTransition } from "react";
import { recordPayout, removePayout } from "@/actions/admin/designers";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { useFieldErrors } from "@/components/ui/useFieldErrors";
import { fmtShort } from "@/lib/admin/dates";
import { inr } from "@/lib/format";
import type { FormState } from "@/lib/form-state";
import type { Payout } from "@/lib/types";

// Record money you've sent a designer (by UPI, outside this site) and see what's been paid.
export function PayoutPanel({ designerId, upiId, balance, payouts }: { designerId: string; upiId: string | null; balance: number; payouts: Payout[] }) {
  const [state, action] = useActionState<FormState, FormData>(recordPayout, {});
  const f = useFieldErrors(state, state.fieldErrors);
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const v = (k: string, fallback = "") => state.values?.[k] ?? fallback;

  useEffect(() => {
    if (state.message) toast({ message: state.message });
  }, [state, toast]);

  return (
    <div className="grid gap-6">
      <p className="admin-label">
        Balance <span className="mono text-fg">{inr(Math.max(0, balance))}</span> · pay to <span className="mono text-fg">{upiId ?? "no UPI ID yet"}</span>
      </p>
      {/* Keyed on the result so the fields clear after a successful payout. */}
      <form key={state.ok ? `ok-${payouts.length}` : "form"} action={action} noValidate className="grid gap-1">
        <input type="hidden" name="designerId" value={designerId} />
        <div className="grid gap-x-4 sm:grid-cols-2">
          <TextField label="Amount sent (₹)" name="amount" type="number" inputMode="numeric" min={1} step={1} defaultValue={v("amount", balance > 0 ? String(balance) : "")} error={f.error("amount")} required />
          <TextField label="UTR / reference" name="reference" autoComplete="off" defaultValue={v("reference")} error={f.error("reference")} />
        </div>
        <TextField label="Note (optional)" name="note" autoComplete="off" defaultValue={v("note")} error={f.error("note")} />
        <div>
          <SubmitButton className="btn-sm" variant="quiet">
            Record payout
          </SubmitButton>
        </div>
      </form>

      {payouts.length > 0 && (
        <ul className="grid divide-y divide-line border-y border-line">
          {payouts.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="mono">{inr(p.amount_inr)}</p>
                <p className="admin-label mt-0.5">
                  {fmtShort(p.paid_at)}
                  {p.reference ? ` · ${p.reference}` : ""}
                  {p.note ? ` · ${p.note}` : ""}
                </p>
              </div>
              <ConfirmButton disabled={pending} confirmLabel="Tap again to remove" onConfirm={() => start(async () => toast({ message: (await removePayout(p.id)).message }))}>
                Remove
              </ConfirmButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

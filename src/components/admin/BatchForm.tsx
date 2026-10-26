"use client";

import { useActionState, useEffect } from "react";
import { createBatch, updateBatch } from "@/actions/admin/batches";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { useFieldErrors } from "@/components/ui/useFieldErrors";
import type { FormState } from "@/lib/form-state";
import type { Batch } from "@/lib/types";

type Props = { batch?: Batch; defaults: { name: string; opens: string; closes: string; est: string } };

export function BatchForm({ batch, defaults }: Props) {
  const [state, action] = useActionState<FormState, FormData>(batch ? updateBatch : createBatch, {});
  const f = useFieldErrors(state, state.fieldErrors);
  const { toast } = useToast();
  const v = (k: "name" | "opens_at" | "closes_at" | "est_delivery", fallback: string) => state.values?.[k] ?? fallback;

  useEffect(() => {
    if (state.message) toast({ message: state.message });
  }, [state, toast]);

  return (
    <form action={action} noValidate className="grid gap-1 sm:grid-cols-2 sm:gap-x-5">
      {batch && <input type="hidden" name="id" value={batch.id} />}
      <TextField label="Name" name="name" defaultValue={v("name", defaults.name)} error={f.error("name")} placeholder="e.g. Batch 02" required />
      <TextField label="Estimated delivery" name="est_delivery" defaultValue={v("est_delivery", defaults.est)} error={f.error("est_delivery")} placeholder="e.g. Around 25 Nov" />
      <TextField label="Opens (IST)" name="opens_at" type="datetime-local" defaultValue={v("opens_at", defaults.opens)} error={f.error("opens_at")} required />
      <TextField label="Cutoff (IST)" name="closes_at" type="datetime-local" defaultValue={v("closes_at", defaults.closes)} error={f.error("closes_at")} help="Orders stop at this time." required />
      {!batch && (
        <label className="mb-3 flex items-center gap-3 sm:col-span-2">
          <input type="checkbox" name="open_now" defaultChecked className="size-5 accent-[var(--accent)]" />
          <span className="text-[0.9rem]">Open it for orders now (closes any other open batch)</span>
        </label>
      )}
      <div className="sm:col-span-2">
        <SubmitButton className="btn-sm">{batch ? "Save batch" : "Create batch"}</SubmitButton>
      </div>
    </form>
  );
}

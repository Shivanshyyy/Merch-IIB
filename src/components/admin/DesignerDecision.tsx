"use client";

import { useActionState, useEffect } from "react";
import { decideDesigner } from "@/actions/admin/designers";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { useFieldErrors } from "@/components/ui/useFieldErrors";
import { COMMISSION_MAX, COMMISSION_MIN } from "@/lib/designer/commission";
import type { FormState } from "@/lib/form-state";
import type { Designer } from "@/lib/types";

// Approve with a commission, reject, suspend, reinstate, or change the rate. Which buttons show depends on the status.
export function DesignerDecision({ designer }: { designer: Designer }) {
  const [state, action, pending] = useActionState<FormState, FormData>(decideDesigner, {});
  const f = useFieldErrors(state, state.fieldErrors);
  const { toast } = useToast();
  const v = (k: string, fallback: string) => state.values?.[k] ?? fallback;
  const { status } = designer;

  useEffect(() => {
    if (state.message) toast({ message: state.message });
  }, [state, toast]);

  const submit = (intent: string, label: string, variant: "primary" | "ghost" | "quiet" = "ghost") => (
    <Button type="submit" name="intent" value={intent} variant={variant} className="btn-sm" disabled={pending}>
      {label}
    </Button>
  );

  return (
    <form action={action} noValidate className="grid gap-1">
      <input type="hidden" name="id" value={designer.id} />
      <TextField
        label="Commission (% of profit)"
        name="commission"
        type="number"
        inputMode="numeric"
        min={COMMISSION_MIN}
        max={COMMISSION_MAX}
        step={1}
        defaultValue={v("commission", designer.commission_pct?.toString() ?? "")}
        error={f.error("commission")}
        help={`A whole number from ${COMMISSION_MIN} to ${COMMISSION_MAX}. Applies to new orders; past orders keep the rate they were placed at.`}
      />
      {(status === "pending" || status === "rejected" || status === "approved") && (
        <div className="field">
          <label htmlFor="decision-note" className="label">
            <span>{status === "approved" ? "Note, shown if you suspend" : "Note to the designer (optional)"}</span>
          </label>
          <textarea id="decision-note" name="note" rows={2} maxLength={500} defaultValue={v("note", designer.decision_note ?? "")} className="input" />
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {status === "pending" && (
          <>
            {submit("approve", "Approve", "primary")}
            {submit("reject", "Reject")}
          </>
        )}
        {status === "rejected" && submit("approve", "Approve instead", "primary")}
        {status === "approved" && (
          <>
            {submit("set_commission", "Update rate", "primary")}
            {submit("suspend", "Suspend")}
          </>
        )}
        {status === "suspended" && (
          <>
            {submit("reinstate", "Reinstate", "primary")}
            {submit("set_commission", "Update rate")}
          </>
        )}
      </div>
    </form>
  );
}

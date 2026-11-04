"use client";

import { useActionState } from "react";
import { reviewDesign } from "@/actions/admin/designs";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useFieldErrors } from "@/components/ui/useFieldErrors";
import type { DesignStatus } from "@/lib/types";
import type { FormState } from "@/lib/form-state";

// Approve, send back with changes, or reject. The note is the designer's feedback and is required for the last two.
export function DesignReview({ designId, status, note }: { designId: string; status: DesignStatus; note: string | null }) {
  const { toast } = useToast();
  // Toast from inside the action: this form unmounts once the design leaves review, so an effect would never run.
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, data) => {
    const result = await reviewDesign(prev, data);
    if (result.message) toast({ message: result.message });
    return result;
  }, {});
  const f = useFieldErrors(state, state.fieldErrors);

  const button = (intent: string, label: string, variant: "primary" | "ghost" = "ghost") => (
    <Button type="submit" name="intent" value={intent} variant={variant} className="btn-sm" disabled={pending}>
      {label}
    </Button>
  );

  return (
    <form action={action} noValidate className="grid gap-3">
      <input type="hidden" name="id" value={designId} />
      <div key={`${status}-${note ?? ""}`} className="field">
        <label htmlFor="review-note" className="label">
          <span>Note to the designer</span>
        </label>
        <textarea id="review-note" name="note" rows={3} maxLength={500} defaultValue={state.values?.note ?? note ?? ""} className="input" aria-invalid={f.error("note") ? true : undefined} />
        <div className="mt-2 min-h-[1.5rem]">{f.error("note") ? <p role="alert" className="field-error m-0">{f.error("note")}</p> : <p className="label normal-case tracking-normal">Optional when approving. Required when asking for changes or rejecting.</p>}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {status === "in_review" && button("approve", "Approve", "primary")}
        {button("changes", "Request changes")}
        {button("reject", "Reject")}
      </div>
    </form>
  );
}

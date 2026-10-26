"use client";

import { useActionState } from "react";
import { submitUtr } from "@/actions/orders";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import type { UtrState } from "@/lib/form-state";

export function UtrForm({ code }: { code: string }) {
  const [state, action] = useActionState<UtrState, FormData>(submitUtr, { ok: false });
  return (
    <form action={action} noValidate className="grid gap-4">
      <input type="hidden" name="code" value={code} />
      <TextField
        label="UTR / transaction ID (optional)"
        name="utr"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        error={state.error}
        help="Find it in your UPI app under the payment details. Saves us time verifying."
      />
      <SubmitButton variant="ghost" block>
        Save UTR
      </SubmitButton>
      {state.ok && (
        <p role="status" className="label text-accent-2">
          {state.message}
        </p>
      )}
    </form>
  );
}

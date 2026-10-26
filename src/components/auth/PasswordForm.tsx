"use client";

import { useActionState } from "react";
import { changePassword } from "@/actions/account";
import { PasswordField } from "@/components/ui/PasswordField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useFieldErrors } from "@/components/ui/useFieldErrors";
import type { FormState } from "@/lib/form-state";
import { passwordSchema } from "@/lib/schemas";

export function PasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(changePassword, {});
  const f = useFieldErrors(state, state.fieldErrors);
  return (
    <form action={action} noValidate className="grid gap-2">
      <PasswordField label="Current password" name="current" autoComplete="current-password" error={f.error("current")} required />
      <PasswordField label="New password" name="next" autoComplete="new-password" error={f.error("next")} onBlur={f.validate("next", passwordSchema)} help="At least 8 characters" required />
      {state.message && (
        <p role={state.ok ? "status" : "alert"} className={state.ok ? "label text-accent-2" : "border border-accent p-3 text-[0.9rem] text-[#ff7a63]"}>
          {state.message}
        </p>
      )}
      <div>
        <SubmitButton variant="ghost">Change password</SubmitButton>
      </div>
    </form>
  );
}

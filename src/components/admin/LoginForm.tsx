"use client";

import { useActionState } from "react";
import { adminLogin } from "@/actions/admin/auth";
import { PasswordField } from "@/components/ui/PasswordField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { FormState } from "@/lib/form-state";

export function AdminLoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(adminLogin, {});
  return (
    <form action={action} noValidate className="grid gap-3">
      <input type="hidden" name="next" value={next} />
      <PasswordField label="Admin password" name="password" autoComplete="current-password" error={state.fieldErrors?.password} required autoFocus />
      {state.message && (
        <p role="alert" className="border border-accent p-3 text-[0.9rem] text-[#ff7a63]">
          {state.message}
        </p>
      )}
      <SubmitButton size="lg" block>
        Log in
      </SubmitButton>
    </form>
  );
}

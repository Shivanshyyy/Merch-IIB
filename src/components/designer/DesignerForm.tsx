"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { applyAsDesigner, designerSignUp, saveDesignerDetails } from "@/actions/designer";
import { Check } from "@/components/ui/Check";
import { PasswordField } from "@/components/ui/PasswordField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { useFieldErrors } from "@/components/ui/useFieldErrors";
import { designerSignUpSchema } from "@/lib/designer/schemas";
import type { FormState } from "@/lib/form-state";

type Mode = "signup" | "apply" | "details";
const ACTIONS = { signup: designerSignUp, apply: applyAsDesigner, details: saveDesignerDetails } as const;
const SUBMIT = { signup: "Create designer account", apply: "Apply as a designer", details: "Save details" } as const;

export function DesignerForm({ mode, defaults }: { mode: Mode; defaults?: { bio?: string | null; upiId?: string | null } }) {
  const [state, action] = useActionState<FormState, FormData>(ACTIONS[mode], {});
  const f = useFieldErrors(state, state.fieldErrors);
  const v = (k: string, fallback = "") => state.values?.[k] ?? fallback;
  const shape = designerSignUpSchema.shape;
  const bioId = useId();

  return (
    <form action={action} noValidate className="grid gap-2">
      {mode === "signup" && (
        <>
          <TextField label="Full name" name="fullName" autoComplete="name" defaultValue={v("fullName")} error={f.error("fullName")} onBlur={f.validate("fullName", shape.fullName)} required />
          <TextField label="Email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" defaultValue={v("email")} error={f.error("email")} onBlur={f.validate("email", shape.email)} help="This is your login. We never send you email." required />
          <PasswordField label="Password" name="password" autoComplete="new-password" error={f.error("password")} onBlur={f.validate("password", shape.password)} help="At least 8 characters" required />
          <TextField label="Phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} defaultValue={v("phone")} error={f.error("phone")} onBlur={f.validate("phone", shape.phone)} help="10-digit Indian mobile number" required />
        </>
      )}

      <div className="field">
        <label htmlFor={bioId} className="label">
          <span>About you (optional)</span>
        </label>
        <textarea id={bioId} name="bio" rows={3} maxLength={300} defaultValue={v("bio", defaults?.bio ?? "")} className="input" aria-invalid={f.error("bio") ? true : undefined} />
        <div className="mt-2 min-h-[1.5rem]">{f.error("bio") ? <p role="alert" className="field-error m-0">{f.error("bio")}</p> : <p className="label normal-case tracking-normal">A line or two on your style. Shown only to the team.</p>}</div>
      </div>
      <TextField
        label="UPI ID for payouts (optional)"
        name="upiId"
        autoComplete="off"
        autoCapitalize="none"
        defaultValue={v("upiId", defaults?.upiId ?? "")}
        error={f.error("upiId")}
        onBlur={f.validate("upiId", shape.upiId)}
        help="Where we send your commission. You can add it later."
      />

      {mode !== "details" && <Check name="agree" defaultChecked={v("agree") === "on"} label={<>I&apos;ve read the <Link href="/policies#designers" target="_blank" className="underline underline-offset-4">designer terms</Link> and this design is my own work.</>} error={f.error("agree")} />}

      {state.message && (
        <p role={state.ok ? "status" : "alert"} className={`mb-2 border p-3 text-[0.9rem] ${state.ok ? "border-line text-fg" : "border-[#b3261e] text-[#b3261e]"}`}>
          {state.message}
        </p>
      )}
      <SubmitButton size="lg" block>
        {SUBMIT[mode]}
      </SubmitButton>
      {mode === "signup" && <p className="label mt-4 normal-case leading-relaxed tracking-normal">You&apos;re logged in straight away. We review applications by hand and you&apos;ll see the result on your dashboard.</p>}
    </form>
  );
}

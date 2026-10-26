"use client";

import { useActionState, useState } from "react";
import { logIn, signUp } from "@/actions/auth";
import { PasswordField } from "@/components/ui/PasswordField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { useFieldErrors } from "@/components/ui/useFieldErrors";
import { logInSchema, signUpSchema } from "@/lib/schemas";
import type { FormState } from "@/lib/form-state";

type Props = { next: string; initialMode?: "login" | "signup"; forgotHref: string; contactName: string };

export function AuthPanel({ next, initialMode = "login", forgotHref, contactName }: Props) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const tab = (m: "login" | "signup", label: string) => (
    <button
      type="button"
      role="tab"
      id={`tab-${m}`}
      aria-selected={mode === m}
      aria-controls={`panel-${m}`}
      onClick={() => setMode(m)}
      className="label flex min-h-12 items-center justify-center transition-colors aria-selected:bg-fg aria-selected:text-bg hover:text-fg aria-selected:hover:text-bg"
    >
      {label}
    </button>
  );

  return (
    <div>
      <div role="tablist" aria-label="Log in or create an account" className="mb-8 grid grid-cols-2 border border-line">
        {tab("login", "Log in")}
        {tab("signup", "Create account")}
      </div>
      {mode === "login" ? <LoginForm next={next} forgotHref={forgotHref} contactName={contactName} /> : <SignUpForm next={next} />}
    </div>
  );
}

function LoginForm({ next, forgotHref, contactName }: { next: string; forgotHref: string; contactName: string }) {
  const [state, action] = useActionState<FormState, FormData>(logIn, {});
  const f = useFieldErrors(state, state.fieldErrors);
  return (
    <div id="panel-login" role="tabpanel" aria-labelledby="tab-login">
    <form action={action} noValidate className="grid gap-2">
      <input type="hidden" name="next" value={next} />
      <TextField label="Email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" defaultValue={state.values?.email} error={f.error("email")} onBlur={f.validate("email", logInSchema.shape.email)} required />
      <PasswordField label="Password" name="password" autoComplete="current-password" error={f.error("password")} required />
      {state.message && (
        <p role="alert" className="mb-2 border border-accent p-3 text-[0.9rem] text-[#ff7a63]">
          {state.message}
        </p>
      )}
      <SubmitButton size="lg" block>
        Log in
      </SubmitButton>
      <p className="label mt-4 normal-case leading-relaxed tracking-normal">
        Forgot your password? We don&apos;t send reset emails.{" "}
        <a href={forgotHref} target="_blank" rel="noopener" className="underline underline-offset-4 hover:text-fg">
          Message {contactName} on WhatsApp
        </a>{" "}
        and they&apos;ll set a new one for you.
      </p>
    </form>
    </div>
  );
}

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

function SignUpForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(signUp, {});
  const f = useFieldErrors(state, state.fieldErrors);
  const v = (k: string) => state.values?.[k];
  const shape = signUpSchema.shape;
  return (
    <div id="panel-signup" role="tabpanel" aria-labelledby="tab-signup">
    <form action={action} noValidate className="grid gap-2">
      <input type="hidden" name="next" value={next} />
      <TextField label="Full name" name="fullName" autoComplete="name" defaultValue={v("fullName")} error={f.error("fullName")} onBlur={f.validate("fullName", shape.fullName)} required />
      <TextField label="Email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" defaultValue={v("email")} error={f.error("email")} onBlur={f.validate("email", shape.email)} help="This is your login. We never send you email." required />
      <PasswordField label="Password" name="password" autoComplete="new-password" error={f.error("password")} onBlur={f.validate("password", shape.password)} help="At least 8 characters" required />
      <TextField label="Phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} defaultValue={v("phone")} error={f.error("phone")} onBlur={f.validate("phone", shape.phone)} help="10-digit Indian mobile number" required />
      <div className="grid gap-x-4 sm:grid-cols-2">
        <TextField label="Roll no. (optional)" name="rollNo" autoComplete="off" autoCapitalize="characters" defaultValue={v("rollNo")} error={f.error("rollNo")} onBlur={f.validate("rollNo", shape.rollNo)} />
        <div className="field">
          <label htmlFor="defaultSize" className="label">
            <span>Usual size (optional)</span>
          </label>
          <select id="defaultSize" name="defaultSize" defaultValue={v("defaultSize") ?? ""} className="input">
            <option value="">No preference</option>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="mt-2 min-h-[1.5rem]" />
        </div>
      </div>
      {state.message && (
        <p role="alert" className="mb-2 border border-accent p-3 text-[0.9rem] text-[#ff7a63]">
          {state.message}
        </p>
      )}
      <SubmitButton size="lg" block>
        Create account
      </SubmitButton>
      <p className="label mt-4 normal-case leading-relaxed tracking-normal">You&apos;re logged in straight away. No email to confirm.</p>
    </form>
    </div>
  );
}

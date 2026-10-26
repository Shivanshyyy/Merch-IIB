"use client";

import { useActionState } from "react";
import { saveProfile } from "@/actions/account";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { useFieldErrors } from "@/components/ui/useFieldErrors";
import type { FormState } from "@/lib/form-state";
import { profileSchema } from "@/lib/schemas";
import type { Profile } from "@/lib/types";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

export function ProfileForm({ email, profile, next, name }: { email: string; profile: Profile | null; next?: string; name?: string | null }) {
  const [state, action] = useActionState<FormState, FormData>(saveProfile, {});
  const f = useFieldErrors(state, state.fieldErrors);
  const v = (k: string, fallback: string) => state.values?.[k] ?? fallback;
  const shape = profileSchema.shape;

  return (
    <form action={action} noValidate className="grid gap-2">
      {next && <input type="hidden" name="next" value={next} />}
      <TextField label="Full name" name="fullName" autoComplete="name" defaultValue={v("fullName", profile?.full_name ?? name ?? "")} error={f.error("fullName")} onBlur={f.validate("fullName", shape.fullName)} required />
      <TextField label="Email" value={email} readOnly aria-readonly help="Your login. To change it, message us on WhatsApp." />
      <TextField label="Phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} defaultValue={v("phone", profile?.phone ?? "")} error={f.error("phone")} onBlur={f.validate("phone", shape.phone)} help="10-digit Indian mobile number" required />
      <div className="grid gap-x-4 sm:grid-cols-2">
        <TextField label="Roll no. (optional)" name="rollNo" autoComplete="off" autoCapitalize="characters" defaultValue={v("rollNo", profile?.roll_no ?? "")} error={f.error("rollNo")} onBlur={f.validate("rollNo", shape.rollNo)} />
        <div className="field">
          <label htmlFor="defaultSize" className="label">
            <span>Usual size (optional)</span>
          </label>
          <select id="defaultSize" name="defaultSize" defaultValue={v("defaultSize", profile?.default_size ?? "")} className="input">
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
        <p role={state.ok ? "status" : "alert"} className={state.ok ? "label text-accent-2" : "border border-accent p-3 text-[0.9rem] text-[#ff7a63]"}>
          {state.message}
        </p>
      )}
      <div>
        <SubmitButton>{profile ? "Save changes" : "Save and continue"}</SubmitButton>
      </div>
    </form>
  );
}

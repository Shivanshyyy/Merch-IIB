"use client";

import { useActionState, useEffect } from "react";
import { updateCustomer } from "@/actions/admin/customers";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { useFieldErrors } from "@/components/ui/useFieldErrors";
import type { FormState } from "@/lib/form-state";
import { profileSchema } from "@/lib/schemas";
import type { Profile } from "@/lib/types";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

export function CustomerForm({ profile }: { profile: Profile }) {
  const [state, action] = useActionState<FormState, FormData>(updateCustomer, {});
  const f = useFieldErrors(state, state.fieldErrors);
  const { toast } = useToast();
  const v = (k: string, fallback: string) => state.values?.[k] ?? fallback;
  const shape = profileSchema.shape;

  useEffect(() => {
    if (state.message) toast({ message: state.message });
  }, [state, toast]);

  return (
    <form action={action} noValidate className="grid gap-1">
      <input type="hidden" name="id" value={profile.id} />
      <TextField label="Full name" name="fullName" defaultValue={v("fullName", profile.full_name)} error={f.error("fullName")} onBlur={f.validate("fullName", shape.fullName)} required />
      <TextField label="Email" value={profile.email} readOnly aria-readonly help="The login. It can't be changed here." />
      <TextField label="Phone" name="phone" type="tel" inputMode="numeric" maxLength={14} defaultValue={v("phone", profile.phone)} error={f.error("phone")} onBlur={f.validate("phone", shape.phone)} required />
      <div className="grid gap-x-4 sm:grid-cols-2">
        <TextField label="Roll no." name="rollNo" autoCapitalize="characters" defaultValue={v("rollNo", profile.roll_no ?? "")} error={f.error("rollNo")} onBlur={f.validate("rollNo", shape.rollNo)} />
        <div className="field">
          <label htmlFor="defaultSize" className="label">
            <span>Usual size</span>
          </label>
          <select id="defaultSize" name="defaultSize" defaultValue={v("defaultSize", profile.default_size ?? "")} className="input">
            <option value="">No preference</option>
            {SIZES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <div className="mt-2 min-h-[1.5rem]" />
        </div>
      </div>
      <div>
        <SubmitButton className="btn-sm">Save customer</SubmitButton>
      </div>
    </form>
  );
}

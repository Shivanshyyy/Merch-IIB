"use client";

import { useActionState, useEffect } from "react";
import { saveTerms } from "@/actions/admin/designs";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { useFieldErrors } from "@/components/ui/useFieldErrors";
import { COMMISSION_MAX, COMMISSION_MIN } from "@/lib/designer/commission";
import type { FormState } from "@/lib/form-state";
import type { ProductTerms } from "@/lib/types";

type Option = { id: string; name: string; rate: number | null };

// Who designed a product and what it costs to make. Past orders keep the terms they were placed with.
export function ProductTermsForm({ productId, terms, designers }: { productId: string; terms: ProductTerms | null; designers: Option[] }) {
  const [state, action] = useActionState<FormState, FormData>(saveTerms, {});
  const f = useFieldErrors(state, state.fieldErrors);
  const { toast } = useToast();
  const v = (k: string, fallback: string) => state.values?.[k] ?? fallback;

  useEffect(() => {
    if (state.message) toast({ message: state.message });
  }, [state, toast]);

  return (
    <section aria-labelledby="terms-h" className="grid gap-4 border-t border-line pt-8">
      <div>
        <h2 id="terms-h" className="t-display text-2xl">
          Cost & designer
        </h2>
        <p className="admin-label mt-2">Private to the admin. Set a designer to pay them commission on every unit sold from now on.</p>
      </div>
      <form action={action} noValidate className="grid gap-1">
        <input type="hidden" name="productId" value={productId} />
        <div className="field">
          <label htmlFor="terms-designer" className="label">
            <span>Designer</span>
          </label>
          <select id="terms-designer" name="designerId" defaultValue={v("designerId", terms?.designer_id ?? "")} className="input">
            <option value="">No designer (in-house)</option>
            {designers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} {d.rate !== null ? `(${d.rate}%)` : ""}
              </option>
            ))}
          </select>
          <div className="mt-2 min-h-[1.5rem]">{f.error("designerId") && <p role="alert" className="field-error m-0">{f.error("designerId")}</p>}</div>
        </div>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <TextField label="Cost to make, per unit (₹)" name="cost_inr" type="number" inputMode="numeric" min={0} step={1} defaultValue={v("cost_inr", terms ? String(terms.cost_inr) : "")} error={f.error("cost_inr")} help="Commission is a share of price minus this." required />
          <TextField
            label="Commission override (%)"
            name="commission"
            type="number"
            inputMode="numeric"
            min={COMMISSION_MIN}
            max={COMMISSION_MAX}
            step={1}
            defaultValue={v("commission", terms?.commission_pct?.toString() ?? "")}
            error={f.error("commission")}
            help="Empty = the designer's own rate."
          />
        </div>
        <div>
          <SubmitButton className="btn-sm" variant="quiet">
            Save terms
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { saveTerms } from "@/actions/admin/designs";
import { PieceMath } from "@/components/admin/PieceMath";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { useFieldErrors } from "@/components/ui/useFieldErrors";
import { COMMISSION_MAX, COMMISSION_MIN } from "@/lib/designer/commission";
import type { FormState } from "@/lib/form-state";
import type { ProductTerms } from "@/lib/types";

type Option = { id: string; name: string; rate: number | null };

// Who designed a product and what it costs to make. Past orders keep the terms they were placed with.
export function ProductTermsForm({ productId, priceInr, terms, designers }: { productId: string; priceInr: number; terms: ProductTerms | null; designers: Option[] }) {
  const [state, action] = useActionState<FormState, FormData>(saveTerms, {});
  const f = useFieldErrors(state, state.fieldErrors);
  const { toast } = useToast();
  const v = (k: string, fallback: string) => state.values?.[k] ?? fallback;

  const [designerId, setDesignerId] = useState(v("designerId", terms?.designer_id ?? ""));
  const [vendor, setVendor] = useState(v("vendor_cost_inr", terms ? String(terms.vendor_cost_inr) : ""));
  const [packaging, setPackaging] = useState(v("packaging_cost_inr", terms ? String(terms.packaging_cost_inr) : ""));
  const [override, setOverride] = useState(v("commission", terms?.commission_pct?.toString() ?? ""));
  const designer = designers.find((d) => d.id === designerId);
  const pct = !designer ? null : override.trim() !== "" ? Number(override) : designer.rate;

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
          <select id="terms-designer" name="designerId" value={designerId} onChange={(e) => setDesignerId(e.target.value)} className="input">
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
          <TextField label="Vendor cost per piece (₹)" name="vendor_cost_inr" type="number" inputMode="numeric" min={0} step={1} value={vendor} onChange={(e) => setVendor(e.target.value)} error={f.error("vendor_cost_inr")} help="Commission is a share of price minus vendor and packaging." required />
          <TextField label="Packaging cost per piece (₹)" name="packaging_cost_inr" type="number" inputMode="numeric" min={0} step={1} value={packaging} onChange={(e) => setPackaging(e.target.value)} error={f.error("packaging_cost_inr")} help="Bag, tag, delivery. Leave empty for none." />
          <TextField
            label="Commission override (%)"
            name="commission"
            type="number"
            inputMode="numeric"
            min={COMMISSION_MIN}
            max={COMMISSION_MAX}
            step={1}
            value={override}
            onChange={(e) => setOverride(e.target.value)}
            error={f.error("commission")}
            help="Empty = the designer's own rate."
          />
        </div>
        <PieceMath price={String(priceInr)} vendor={vendor} packaging={packaging} pct={pct} />
        <div>
          <SubmitButton className="btn-sm" variant="quiet">
            Save terms
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}

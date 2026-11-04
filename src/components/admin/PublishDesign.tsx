"use client";

import { useActionState, useEffect, useState } from "react";
import { publishDesign } from "@/actions/admin/designs";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { useFieldErrors } from "@/components/ui/useFieldErrors";
import { commissionPreview } from "@/lib/admin/designer-flow";
import { COMMISSION_MAX, COMMISSION_MIN, isValidCommission } from "@/lib/designer/commission";
import { inr } from "@/lib/format";
import type { FormState } from "@/lib/form-state";

type Props = { designId: string; designerRate: number; defaults: { name: string; slug: string; description: string; price: string; sizes: string } };

// Puts an approved design in the shop. The preview shows what each sale earns the designer before anything goes live.
export function PublishDesign({ designId, designerRate, defaults }: Props) {
  const [state, action] = useActionState<FormState, FormData>(publishDesign, {});
  const f = useFieldErrors(state, state.fieldErrors);
  const { toast } = useToast();
  const v = (k: string, fallback: string) => state.values?.[k] ?? fallback;
  const [price, setPrice] = useState(v("price_inr", defaults.price));
  const [cost, setCost] = useState(v("cost_inr", ""));
  const [override, setOverride] = useState(v("commission", ""));

  useEffect(() => {
    if (state.message) toast({ message: state.message });
  }, [state, toast]);

  const p = Number(price);
  const c = Number(cost);
  const pct = override.trim() === "" ? designerRate : Number(override);
  const ready = price.trim() !== "" && cost.trim() !== "" && Number.isFinite(p) && Number.isFinite(c) && c >= 0 && c < p && isValidCommission(pct);
  const preview = ready ? commissionPreview(p, c, pct) : null;

  return (
    <form action={action} noValidate className="grid gap-1">
      <input type="hidden" name="id" value={designId} />
      <div className="grid gap-x-4 sm:grid-cols-2">
        <TextField label="Product name" name="name" defaultValue={v("name", defaults.name)} error={f.error("name")} required />
        <TextField label="Web address (slug)" name="slug" autoCapitalize="none" defaultValue={v("slug", defaults.slug)} error={f.error("slug")} help="/shop/this-part" required />
      </div>
      <div className="field">
        <label htmlFor="publish-description" className="label">
          <span>Description</span>
        </label>
        <textarea id="publish-description" name="description" rows={3} maxLength={400} defaultValue={v("description", defaults.description)} className="input" aria-invalid={f.error("description") ? true : undefined} />
        <div className="mt-2 min-h-[1.5rem]">{f.error("description") && <p role="alert" className="field-error m-0">{f.error("description")}</p>}</div>
      </div>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <TextField label="Selling price (₹)" name="price_inr" type="number" inputMode="numeric" min={1} step={1} value={price} onChange={(e) => setPrice(e.target.value)} error={f.error("price_inr")} help="What customers pay" required />
        <TextField label="Cost to make, per unit (₹)" name="cost_inr" type="number" inputMode="numeric" min={0} step={1} value={cost} onChange={(e) => setCost(e.target.value)} error={f.error("cost_inr")} help="Vendor price. Never shown to the designer or customers." required />
      </div>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <TextField label="Sizes" name="sizes" defaultValue={v("sizes", defaults.sizes)} error={f.error("sizes")} help="Separate with commas" required />
        <TextField label="Name print fee (₹)" name="name_fee_inr" type="number" inputMode="numeric" min={0} step={1} defaultValue={v("name_fee_inr", "0")} error={f.error("name_fee_inr")} help="0 = free" />
      </div>
      <TextField
        label={`Commission override (%) for this product`}
        name="commission"
        type="number"
        inputMode="numeric"
        min={COMMISSION_MIN}
        max={COMMISSION_MAX}
        step={1}
        value={override}
        onChange={(e) => setOverride(e.target.value)}
        error={f.error("commission")}
        help={`Leave empty to use the designer's rate (${designerRate}%).`}
      />

      <p role="status" className="admin-card mb-2 p-4 text-[0.95rem]">
        {preview ? (
          <>
            Profit per unit <span className="mono">{inr(preview.profit)}</span>. At <span className="mono">{pct}%</span> the designer earns <span className="mono">{inr(preview.commission)}</span> per unit, and you keep <span className="mono">{inr(preview.profit - preview.commission)}</span>.
          </>
        ) : (
          <span className="text-muted">Enter the price and cost to see what the designer earns per sale.</span>
        )}
      </p>
      <div>
        <SubmitButton>Put it live</SubmitButton>
      </div>
    </form>
  );
}

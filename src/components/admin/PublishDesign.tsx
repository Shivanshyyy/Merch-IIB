"use client";

import { useActionState, useState } from "react";
import { publishDesign } from "@/actions/admin/designs";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { useFieldErrors } from "@/components/ui/useFieldErrors";
import { PieceMath } from "@/components/admin/PieceMath";
import { COMMISSION_MAX, COMMISSION_MIN } from "@/lib/designer/commission";
import type { FormState } from "@/lib/form-state";

type Props = { designId: string; designerRate: number; defaults: { name: string; slug: string; description: string; price: string; sizes: string } };

// Puts an approved design in the shop. The preview shows what each sale earns the designer before anything goes live.
export function PublishDesign({ designId, designerRate, defaults }: Props) {
  const { toast } = useToast();
  // Toast from inside the action: this form disappears once the design is live, so an effect would never run.
  const [state, action] = useActionState<FormState, FormData>(async (prev, data) => {
    const result = await publishDesign(prev, data);
    if (result.message) toast({ message: result.message });
    return result;
  }, {});
  const f = useFieldErrors(state, state.fieldErrors);
  const v = (k: string, fallback: string) => state.values?.[k] ?? fallback;
  const [price, setPrice] = useState(v("price_inr", defaults.price));
  const [vendor, setVendor] = useState(v("vendor_cost_inr", ""));
  const [packaging, setPackaging] = useState(v("packaging_cost_inr", ""));
  const [override, setOverride] = useState(v("commission", ""));

  const pct = override.trim() === "" ? designerRate : Number(override);

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
        <TextField label="Vendor cost per piece (₹)" name="vendor_cost_inr" type="number" inputMode="numeric" min={0} step={1} value={vendor} onChange={(e) => setVendor(e.target.value)} error={f.error("vendor_cost_inr")} help="What the vendor charges. Never shown to the designer or customers." required />
      </div>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <TextField label="Packaging cost per piece (₹)" name="packaging_cost_inr" type="number" inputMode="numeric" min={0} step={1} value={packaging} onChange={(e) => setPackaging(e.target.value)} error={f.error("packaging_cost_inr")} help="Bag, tag, delivery. Leave empty for none." />
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

      <PieceMath price={price} vendor={vendor} packaging={packaging} pct={pct} />
      <div>
        <SubmitButton>Put it live</SubmitButton>
      </div>
    </form>
  );
}

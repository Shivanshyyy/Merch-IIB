"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { createDesign, saveDesign } from "@/actions/designs";
import { Check } from "@/components/ui/Check";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { useFieldErrors } from "@/components/ui/useFieldErrors";
import { site } from "@/config/site";
import { designSchema } from "@/lib/designer/schemas";
import { GARMENT_COLOURS } from "@/lib/designer/palette";
import type { FormState } from "@/lib/form-state";
import type { Design } from "@/lib/types";

// Create (no design) or edit one. The images are added on the next screen, once the design exists.
export function DesignForm({ design }: { design?: Design }) {
  const [state, action] = useActionState<FormState, FormData>(design ? saveDesign : createDesign, {});
  const f = useFieldErrors(state, state.fieldErrors);
  const shape = designSchema.shape;
  const descId = useId();
  const v = (k: string, fallback = "") => state.values?.[k] ?? fallback;
  const type = v("productType", design?.product_type ?? "hoodie");
  const picked = state.values ? new Set(v("colours").split("|").filter(Boolean)) : new Set((design?.colorways ?? []).map((c) => c.name));
  const confirmed = state.values ? v("originality") === "on" : Boolean(design?.originality_confirmed_at);

  return (
    <form action={action} noValidate className="grid gap-2">
      {design && <input type="hidden" name="designId" value={design.id} />}
      <TextField label="Title" name="title" autoComplete="off" maxLength={60} defaultValue={v("title", design?.title ?? "")} error={f.error("title")} onBlur={f.validate("title", shape.title)} required />

      <fieldset className="mb-2">
        <legend className="label mb-3">Garment</legend>
        <div className="flex flex-wrap gap-2">
          {(["hoodie", "tee"] as const).map((t) => (
            <label key={t} className="chip">
              <input type="radio" name="productType" value={t} defaultChecked={type === t} className="sr-only" />
              {t === "hoodie" ? "Hoodie" : "T-shirt"}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-2">
        <legend className="label mb-3">Garment colours (up to {site.maxDesignColorways})</legend>
        <div className="flex flex-wrap gap-2">
          {GARMENT_COLOURS.map((c) => (
            <label key={c.name} className="chip">
              <input type="checkbox" name="colour" value={c.name} defaultChecked={picked.has(c.name)} className="sr-only" />
              <span aria-hidden className="size-3.5 rounded-full border border-current/30" style={{ background: c.body }} />
              {c.name}
            </label>
          ))}
        </div>
        <div className="mt-2 min-h-[1.5rem]">{f.error("colours") && <p role="alert" className="field-error m-0">{f.error("colours")}</p>}</div>
      </fieldset>

      <div className="field">
        <label htmlFor={descId} className="label">
          <span>Description (optional)</span>
        </label>
        <textarea id={descId} name="description" rows={4} maxLength={600} defaultValue={v("description", design?.description ?? "")} className="input" aria-invalid={f.error("description") ? true : undefined} />
        <div className="mt-2 min-h-[1.5rem]">{f.error("description") ? <p role="alert" className="field-error m-0">{f.error("description")}</p> : <p className="label normal-case tracking-normal">The idea behind it. Shown to the team, and on the product page if it goes live.</p>}</div>
      </div>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <TextField
          label="Price you suggest, ₹ (optional)"
          name="suggestedPrice"
          inputMode="numeric"
          autoComplete="off"
          defaultValue={v("suggestedPrice", design?.suggested_price_inr?.toString() ?? "")}
          error={f.error("suggestedPrice")}
          onBlur={f.validate("suggestedPrice", shape.suggestedPrice)}
          help="The team sets the final price."
        />
        <TextField
          label="Print-ready file link (optional)"
          name="printFileUrl"
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          defaultValue={v("printFileUrl", design?.print_file_url ?? "")}
          error={f.error("printFileUrl")}
          onBlur={f.validate("printFileUrl", shape.printFileUrl)}
          help="A Drive or Dropbox link, https only."
        />
      </div>

      <Check name="originality" defaultChecked={confirmed} label={<>This design is my own work, and I&apos;m allowed to sell it (<Link href="/policies#designers" target="_blank" className="underline underline-offset-4">designer terms</Link>).</>} />

      {state.message && (
        <p role={state.ok ? "status" : "alert"} className={`mb-2 border p-3 text-[0.9rem] ${state.ok ? "border-line text-fg" : "border-[#b3261e] text-[#b3261e]"}`}>
          {state.message}
        </p>
      )}
      <SubmitButton size="lg" block>
        {design ? "Save changes" : "Create design and add images"}
      </SubmitButton>
    </form>
  );
}

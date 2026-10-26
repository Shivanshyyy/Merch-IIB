"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { saveProduct } from "@/actions/admin/products";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { useFieldErrors } from "@/components/ui/useFieldErrors";
import { productSchema } from "@/lib/admin/schemas";
import { slugify } from "@/lib/format";
import type { FormState } from "@/lib/form-state";
import type { Colorway, Product } from "@/lib/types";

const BLANK: Colorway = { name: "", body: "#1a1a1d", stitch: "#ff3b1f" };

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, action] = useActionState<FormState, FormData>(saveProduct, {});
  const f = useFieldErrors(state, state.fieldErrors);

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const slugTouched = useRef(!!product);
  const [colorways, setColorways] = useState<Colorway[]>(product?.colorways.length ? product.colorways : [BLANK]);
  const set = (i: number, patch: Partial<Colorway>) => setColorways((c) => c.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const v = (k: string, fallback: string) => state.values?.[k] ?? fallback;

  useEffect(() => {
    if (!state.message) return;
    toast({ message: state.message });
    if (state.ok && !product) router.replace("/admin/products");
  }, [state, product, router, toast]);

  const shape = productSchema.shape;
  const box = "input !min-h-11";

  return (
    <form action={action} noValidate className="grid gap-2">
      {product && <input type="hidden" name="id" value={product.id} />}
      <input type="hidden" name="colorways" value={JSON.stringify(colorways)} />

      <div className="grid gap-x-5 sm:grid-cols-2">
        <TextField
          label="Name"
          name="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched.current) setSlug(slugify(e.target.value));
          }}
          error={f.error("name")}
          onBlur={f.validate("name", shape.name)}
          required
        />
        <TextField
          label="Slug (the web address)"
          name="slug"
          value={slug}
          onChange={(e) => {
            slugTouched.current = true;
            setSlug(e.target.value);
          }}
          error={f.error("slug")}
          onBlur={f.validate("slug", shape.slug)}
          help={`/shop/${slug || "…"}`}
          autoCapitalize="none"
          required
        />
      </div>

      <div className="grid gap-x-5 sm:grid-cols-3">
        <div className="field">
          <label htmlFor="type" className="label">
            <span>Type</span>
          </label>
          <select id="type" name="type" defaultValue={v("type", product?.type ?? "hoodie")} className={box}>
            <option value="hoodie">Hoodie</option>
            <option value="tee">T-shirt</option>
          </select>
          <div className="mt-2 min-h-[1.5rem]" />
        </div>
        <TextField label="Price (₹)" name="price_inr" type="number" inputMode="numeric" min={0} step={1} defaultValue={v("price_inr", String(product?.price_inr ?? 999))} error={f.error("price_inr")} help="Whole rupees" required />
        <TextField label="Sort order" name="sort" type="number" inputMode="numeric" min={0} defaultValue={v("sort", String(product?.sort ?? 0))} error={f.error("sort")} help="Lower comes first" />
      </div>

      <div className="field">
        <label htmlFor="description" className="label">
          <span>Description</span>
        </label>
        <textarea id="description" name="description" defaultValue={v("description", product?.description ?? "")} maxLength={400} className="input min-h-24" aria-invalid={f.error("description") ? true : undefined} />
        <div className="mt-2 min-h-[1.5rem]">{f.error("description") && <p className="field-error m-0">{f.error("description")}</p>}</div>
      </div>

      <TextField label="Sizes" name="sizes" defaultValue={v("sizes", (product?.sizes ?? ["S", "M", "L", "XL", "XXL"]).join(", "))} error={f.error("sizes")} help="Separate with commas, e.g. S, M, L, XL" required />

      <fieldset className="mt-2">
        <legend className="label mb-3">Colourways</legend>
        <ul className="grid gap-3">
          {colorways.map((c, i) => (
            <li key={i} className="grid gap-3 border border-line bg-bg-2 p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
              <label className="grid gap-1">
                <span className="admin-label">Colourway name</span>
                <input className={box} value={c.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="e.g. Midnight" maxLength={30} />
              </label>
              {(["body", "stitch"] as const).map((k) => (
                <label key={k} className="grid gap-1">
                  <span className="admin-label">{k === "body" ? "Fabric colour" : "Stitch colour"}</span>
                  <span className="flex items-center gap-2">
                    <input type="color" aria-label={`${k === "body" ? "Fabric" : "Stitch"} colour picker`} value={/^#[0-9a-f]{6}$/i.test(c[k]) ? c[k] : "#000000"} onChange={(e) => set(i, { [k]: e.target.value })} className="size-11 shrink-0 cursor-pointer border border-line bg-transparent p-1" />
                    <input className={`${box} !w-28 mono`} value={c[k]} onChange={(e) => set(i, { [k]: e.target.value })} maxLength={7} spellCheck={false} aria-label={`${k === "body" ? "Fabric" : "Stitch"} colour hex`} />
                  </span>
                </label>
              ))}
              <div className="flex items-center gap-3">
                <span aria-hidden title="Preview" className="relative block size-11 overflow-hidden border border-line" style={{ background: c.body }}>
                  <span className="absolute inset-x-1 top-1/2 h-0.5 -rotate-12" style={{ background: c.stitch }} />
                </span>
                <button type="button" onClick={() => setColorways((rows) => rows.filter((_, j) => j !== i))} disabled={colorways.length === 1} className="admin-label min-h-11 px-2 hover:text-fg disabled:opacity-30" aria-label={`Remove colourway ${i + 1}`}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
        {f.error("colorways") && (
          <p role="alert" className="field-error">
            {f.error("colorways")}
          </p>
        )}
        <div className="mt-3">
          <Button variant="quiet" className="btn-sm" disabled={colorways.length >= 8} onClick={() => setColorways((c) => [...c, { ...BLANK }])}>
            Add colourway
          </Button>
        </div>
        <p className="admin-label mt-3">New colourways have no studio photo yet; the shop shows a placeholder until one is rendered.</p>
      </fieldset>

      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
        <label className="flex items-center gap-3">
          <input type="checkbox" name="personalizable" defaultChecked={product?.personalizable ?? true} className="size-5 accent-[var(--accent)]" />
          <span className="text-[0.9rem]">Customers can add a name</span>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="active" defaultChecked={product?.active ?? true} className="size-5 accent-[var(--accent)]" />
          <span className="text-[0.9rem]">Live in the shop</span>
        </label>
      </div>

      {state.message && !state.ok && (
        <p role="alert" className="mt-2 border border-accent p-3 text-[0.9rem] text-[#ff7a63]">
          {state.message}
        </p>
      )}
      <div className="mt-4">
        <SubmitButton>{product ? "Save product" : "Create product"}</SubmitButton>
      </div>
    </form>
  );
}

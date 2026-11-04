"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { canPublish, planDesignReview, type DesignReview } from "@/lib/admin/designer-flow";
import { adminAction } from "@/lib/admin/guard";
import { parseSizes, publishSchema, termsSchema } from "@/lib/admin/schemas";
import { db, SlugTakenError } from "@/lib/db";
import type { FormState } from "@/lib/form-state";
import type { ProductInput } from "@/lib/types";

const text = (f: FormData, k: string) => String(f.get(k) ?? "");
const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
// Packaging is optional: empty means none.
const packagingNum = (s: string) => (s.trim() === "" ? 0 : Number(s));
const firstErrors = (error: z.ZodError) => Object.fromEntries(Object.entries(z.flattenError(error).fieldErrors).map(([k, v]) => [k, (v as string[])[0]]));
const refresh = () => {
  updateTag("products");
  revalidatePath("/admin", "layout");
};
const commissionOrNull = (s: string) => (s.trim() === "" ? null : Number(s));

export async function reviewDesign(_prev: FormState, formData: FormData): Promise<FormState> {
  return adminAction(async () => {
    const id = text(formData, "id");
    const values = { note: text(formData, "note") };
    if (!z.uuid().safeParse(id).success) return { ok: false, message: "Design not found.", values };
    const intent = text(formData, "intent");
    const review: DesignReview | null = intent === "approve" ? { type: "approve", note: values.note } : intent === "changes" || intent === "reject" ? { type: intent, note: values.note } : null;
    if (!review) return { ok: false, message: "Choose what to do.", values };

    try {
      const d = db();
      const design = await d.getDesign(id);
      if (!design) return { ok: false, message: "Design not found.", values };
      const plan = planDesignReview(design, review, new Date());
      if (!plan.ok) return { ok: false, message: plan.message, fieldErrors: review.type !== "approve" ? { note: plan.message } : undefined, values };
      await d.patchDesign(id, plan.patch);
      refresh();
      return { ok: true, message: plan.message, values: { note: "" } };
    } catch (e) {
      console.error("[admin reviewDesign]", e);
      return { ok: false, message: "Couldn't save the review.", values };
    }
  });
}

// Creates the shop product from an approved design: its details, a copy of the images and the cost/designer terms.
export async function publishDesign(_prev: FormState, formData: FormData): Promise<FormState> {
  return adminAction(async () => {
    const id = text(formData, "id");
    const values = Object.fromEntries(["name", "slug", "description", "price_inr", "vendor_cost_inr", "packaging_cost_inr", "name_fee_inr", "sizes", "commission"].map((k) => [k, text(formData, k)]));
    if (!z.uuid().safeParse(id).success) return { ok: false, message: "Design not found.", values };
    const parsed = publishSchema.safeParse({
      name: values.name,
      slug: values.slug,
      description: values.description,
      price_inr: num(values.price_inr),
      vendor_cost_inr: num(values.vendor_cost_inr),
      packaging_cost_inr: packagingNum(values.packaging_cost_inr),
      name_fee_inr: values.name_fee_inr.trim() === "" ? 0 : Number(values.name_fee_inr),
      sizes: parseSizes(values.sizes),
      commission: commissionOrNull(values.commission),
    });
    if (!parsed.success) return { ok: false, fieldErrors: firstErrors(parsed.error), message: "Please fix the highlighted fields.", values };
    const p = parsed.data;

    const d = db();
    let productId: string | undefined;
    try {
      const design = await d.getDesign(id);
      if (!design) return { ok: false, message: "Design not found.", values };
      const blocked = canPublish(design, await d.getDesigner(design.designer_id));
      if (blocked) return { ok: false, message: blocked, values };

      const sort = Math.max(0, ...(await d.listAllProducts()).map((x) => x.sort)) + 1;
      const input: ProductInput = { slug: p.slug, name: p.name, type: design.product_type, description: p.description, price_inr: p.price_inr, compare_at_inr: null, name_fee_inr: p.name_fee_inr, colorways: design.colorways, sizes: p.sizes, personalizable: true, active: true, sort };
      productId = (await d.createProduct(input)).id;

      for (const imageId of design.images) {
        const image = await d.getDesignImage(imageId);
        if (image) await d.addProductPhoto(productId, { mime: image.mime, bytes: image.bytes });
      }
      await d.saveProductTerms({ product_id: productId, designer_id: design.designer_id, design_id: design.id, cost_inr: p.vendor_cost_inr + p.packaging_cost_inr, vendor_cost_inr: p.vendor_cost_inr, packaging_cost_inr: p.packaging_cost_inr, commission_pct: p.commission });
      await d.patchDesign(id, { status: "live", product_id: productId });
    } catch (e) {
      if (productId) await d.deleteProduct(productId).catch(() => {}); // don't leave a half-published product on sale
      if (e instanceof SlugTakenError) return { ok: false, fieldErrors: { slug: "Another product already uses this slug." }, message: "Please fix the highlighted fields.", values };
      console.error("[admin publishDesign]", e);
      return { ok: false, message: "Couldn't put the design live. Nothing was published.", values };
    }
    refresh();
    return { ok: true, id: productId, message: "Design is live in the shop.", values };
  });
}

// Takes a live design off sale: the product is hidden (old orders keep their items) and the design is retired.
export async function retireDesign(designId: string) {
  return adminAction(async () => {
    if (!z.uuid().safeParse(designId).success) return { ok: false as const, message: "Design not found." };
    try {
      const d = db();
      const design = await d.getDesign(designId);
      if (!design || design.status !== "live") return { ok: false as const, message: "Only a live design can be taken off sale." };
      if (design.product_id) {
        const product = await d.getProductById(design.product_id);
        if (product) {
          const { id: _id, photos: _photos, ...rest } = product;
          void _id;
          void _photos;
          await d.updateProduct(product.id, { ...rest, active: false });
        }
      }
      await d.patchDesign(designId, { status: "retired" });
    } catch (e) {
      console.error("[admin retireDesign]", e);
      return { ok: false as const, message: "Couldn't take the design off sale." };
    }
    refresh();
    return { ok: true as const, message: "Design taken off sale." };
  });
}

// Cost and designer for any product, from the product editor.
export async function saveTerms(_prev: FormState, formData: FormData): Promise<FormState> {
  return adminAction(async () => {
    const productId = text(formData, "productId");
    const values = { designerId: text(formData, "designerId"), vendor_cost_inr: text(formData, "vendor_cost_inr"), packaging_cost_inr: text(formData, "packaging_cost_inr"), commission: text(formData, "commission") };
    if (!z.uuid().safeParse(productId).success) return { ok: false, message: "Product not found.", values };
    const parsed = termsSchema.safeParse({ designerId: values.designerId || null, vendor_cost_inr: num(values.vendor_cost_inr), packaging_cost_inr: packagingNum(values.packaging_cost_inr), commission: commissionOrNull(values.commission) });
    if (!parsed.success) return { ok: false, fieldErrors: firstErrors(parsed.error), message: "Please fix the highlighted fields.", values };

    try {
      const d = db();
      const product = await d.getProductById(productId);
      if (!product) return { ok: false, message: "Product not found.", values };
      if (parsed.data.vendor_cost_inr + parsed.data.packaging_cost_inr >= product.price_inr && product.price_inr > 0) return { ok: false, fieldErrors: { vendor_cost_inr: "Vendor + packaging must be below the selling price" }, message: "Please fix the highlighted fields.", values };
      const existing = await d.getProductTerms(productId);
      if (parsed.data.designerId && parsed.data.designerId !== existing?.designer_id) {
        const designer = await d.getDesigner(parsed.data.designerId);
        if (!designer || designer.status !== "approved") return { ok: false, fieldErrors: { designerId: "Pick an approved designer" }, message: "Please fix the highlighted fields.", values };
      }
      await d.saveProductTerms({ product_id: productId, designer_id: parsed.data.designerId, design_id: existing?.design_id ?? null, cost_inr: parsed.data.vendor_cost_inr + parsed.data.packaging_cost_inr, vendor_cost_inr: parsed.data.vendor_cost_inr, packaging_cost_inr: parsed.data.packaging_cost_inr, commission_pct: parsed.data.commission });
    } catch (e) {
      console.error("[admin saveTerms]", e);
      return { ok: false, message: "Couldn't save the terms.", values };
    }
    refresh();
    return { ok: true, message: "Saved. It applies to new orders.", values };
  });
}

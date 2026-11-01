"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { adminAction } from "@/lib/admin/guard";
import { parseSizes, productSchema } from "@/lib/admin/schemas";
import { db, SlugTakenError } from "@/lib/db";
import type { FormState } from "@/lib/form-state";
import { BadPhotoError, normalizePhoto } from "@/lib/photo-process";
import { MAX_PHOTOS_PER_PRODUCT, MAX_UPLOAD_BYTES } from "@/lib/photos";

const text = (f: FormData, k: string) => String(f.get(k) ?? "");
const firstErrors = (error: z.ZodError) => Object.fromEntries(Object.entries(z.flattenError(error).fieldErrors).map(([k, v]) => [k, (v as string[])[0]]));

const refresh = () => {
  updateTag("products"); // shop grid and product pages read the catalogue through this tag
  revalidatePath("/admin", "layout");
};

export async function saveProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  return adminAction(async () => {
    const id = text(formData, "id");
    const values = Object.fromEntries(["name", "slug", "type", "description", "price_inr", "compare_at_inr", "name_fee_inr", "sizes", "sort", "colorways"].map((k) => [k, text(formData, k)]));

    let colorways: unknown = [];
    try {
      colorways = JSON.parse(values.colorways || "[]");
    } catch {
      return { ok: false, message: "The colourways couldn't be read. Reload the page and try again.", values };
    }
    const parsed = productSchema.safeParse({
      name: values.name,
      slug: values.slug,
      type: values.type,
      description: values.description,
      price_inr: values.price_inr === "" ? NaN : Number(values.price_inr),
      compare_at_inr: values.compare_at_inr.trim() === "" ? null : Number(values.compare_at_inr),
      name_fee_inr: values.name_fee_inr.trim() === "" ? 0 : Number(values.name_fee_inr),
      sizes: parseSizes(values.sizes),
      colorways,
      personalizable: formData.get("personalizable") === "on",
      active: formData.get("active") === "on",
      sort: values.sort === "" ? 0 : Number(values.sort),
    });
    if (!parsed.success) return { ok: false, fieldErrors: firstErrors(parsed.error), message: "Please fix the highlighted fields.", values };
    if (parsed.data.compare_at_inr !== null && parsed.data.compare_at_inr <= parsed.data.price_inr)
      return { ok: false, fieldErrors: { compare_at_inr: "Must be higher than the selling price (or leave it empty)" }, message: "Please fix the highlighted fields.", values };

    let createdId: string | undefined;
    try {
      if (id) {
        if (!z.uuid().safeParse(id).success) return { ok: false, message: "Product not found.", values };
        await db().updateProduct(id, parsed.data);
      } else {
        createdId = (await db().createProduct(parsed.data)).id;
      }
    } catch (e) {
      if (e instanceof SlugTakenError) return { ok: false, fieldErrors: { slug: "Another product already uses this slug." }, values };
      console.error("[admin saveProduct]", e);
      return { ok: false, message: "Couldn't save the product.", values };
    }
    refresh();
    return { ok: true, id: createdId, message: id ? "Product saved." : "Product created.", values };
  });
}

export async function setProductActive(productId: string, active: boolean) {
  return adminAction(async () => {
    if (!z.uuid().safeParse(productId).success) return { ok: false as const, message: "Product not found." };
    try {
      const d = db();
      const p = await d.getProductById(productId);
      if (!p) return { ok: false as const, message: "Product not found." };
      const { id: _id, photos: _photos, ...rest } = p; // photos live in their own table, not a column of products
      void _id;
      void _photos;
      await d.updateProduct(productId, { ...rest, active });
    } catch (e) {
      console.error("[admin setProductActive]", e);
      return { ok: false as const, message: "Couldn't update the product." };
    }
    refresh();
    return { ok: true as const, message: active ? "Product is live." : "Product hidden from the shop." };
  });
}

export async function addProductPhoto(productId: string, formData: FormData) {
  return adminAction(async () => {
    if (!z.uuid().safeParse(productId).success) return { ok: false as const, message: "Product not found." };
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) return { ok: false as const, message: "Choose a photo first." };
    if (file.size > MAX_UPLOAD_BYTES) return { ok: false as const, message: "That photo is too big (4 MB at most)." };
    try {
      const d = db();
      const product = await d.getProductById(productId);
      if (!product) return { ok: false as const, message: "Product not found." };
      if (product.photos.length >= MAX_PHOTOS_PER_PRODUCT) return { ok: false as const, message: `A product can have ${MAX_PHOTOS_PER_PRODUCT} photos. Remove one first.` };
      await d.addProductPhoto(productId, await normalizePhoto(Buffer.from(await file.arrayBuffer())));
    } catch (e) {
      if (e instanceof BadPhotoError) return { ok: false as const, message: e.message };
      console.error("[admin addProductPhoto]", e);
      return { ok: false as const, message: "Couldn't save the photo." };
    }
    refresh();
    return { ok: true as const, message: "Photo added." };
  });
}

export async function removeProductPhoto(productId: string, photoId: string) {
  return adminAction(async () => {
    if (!z.uuid().safeParse(productId).success || !z.uuid().safeParse(photoId).success) return { ok: false as const, message: "Photo not found." };
    try {
      await db().removeProductPhoto(productId, photoId);
    } catch (e) {
      console.error("[admin removeProductPhoto]", e);
      return { ok: false as const, message: "Couldn't remove the photo." };
    }
    refresh();
    return { ok: true as const, message: "Photo removed." };
  });
}

export async function deleteProduct(productId: string) {
  return adminAction(async () => {
    if (!z.uuid().safeParse(productId).success) return { ok: false as const, message: "Product not found." };
    try {
      await db().deleteProduct(productId); // existing orders keep their own snapshot of name, colour, size and price
    } catch (e) {
      console.error("[admin deleteProduct]", e);
      return { ok: false as const, message: "Couldn't delete the product." };
    }
    refresh();
    return { ok: true as const, message: "Product deleted." };
  });
}

"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { adminAction } from "@/lib/admin/guard";
import { parseSizes, productSchema } from "@/lib/admin/schemas";
import { db, SlugTakenError } from "@/lib/db";
import type { FormState } from "@/lib/form-state";

const text = (f: FormData, k: string) => String(f.get(k) ?? "");
const firstErrors = (error: z.ZodError) => Object.fromEntries(Object.entries(z.flattenError(error).fieldErrors).map(([k, v]) => [k, (v as string[])[0]]));

const refresh = () => {
  updateTag("products"); // shop grid and product pages read the catalogue through this tag
  revalidatePath("/admin", "layout");
};

export async function saveProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  return adminAction(async () => {
    const id = text(formData, "id");
    const values = Object.fromEntries(["name", "slug", "type", "description", "price_inr", "sizes", "sort", "colorways"].map((k) => [k, text(formData, k)]));

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
      sizes: parseSizes(values.sizes),
      colorways,
      personalizable: formData.get("personalizable") === "on",
      active: formData.get("active") === "on",
      sort: values.sort === "" ? 0 : Number(values.sort),
    });
    if (!parsed.success) return { ok: false, fieldErrors: firstErrors(parsed.error), message: "Please fix the highlighted fields.", values };

    try {
      if (id) {
        if (!z.uuid().safeParse(id).success) return { ok: false, message: "Product not found.", values };
        await db().updateProduct(id, parsed.data);
      } else {
        await db().createProduct(parsed.data);
      }
    } catch (e) {
      if (e instanceof SlugTakenError) return { ok: false, fieldErrors: { slug: "Another product already uses this slug." }, values };
      console.error("[admin saveProduct]", e);
      return { ok: false, message: "Couldn't save the product.", values };
    }
    refresh();
    return { ok: true, message: id ? "Product saved." : "Product created.", values };
  });
}

export async function setProductActive(productId: string, active: boolean) {
  return adminAction(async () => {
    if (!z.uuid().safeParse(productId).success) return { ok: false as const, message: "Product not found." };
    try {
      const d = db();
      const p = await d.getProductById(productId);
      if (!p) return { ok: false as const, message: "Product not found." };
      const { id: _id, ...rest } = p;
      void _id;
      await d.updateProduct(productId, { ...rest, active });
    } catch (e) {
      console.error("[admin setProductActive]", e);
      return { ok: false as const, message: "Couldn't update the product." };
    }
    refresh();
    return { ok: true as const, message: active ? "Product is live." : "Product hidden from the shop." };
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

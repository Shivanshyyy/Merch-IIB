"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { site } from "@/config/site";
import { requireApprovedDesigner } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { canMove, designerCanDelete, designerCanEdit, submitProblems } from "@/lib/designer/design-flow";
import { designSchema, toDesignInput } from "@/lib/designer/schemas";
import type { FormState } from "@/lib/form-state";
import { BadPhotoError, normalizePhoto } from "@/lib/photo-process";
import { MAX_UPLOAD_BYTES } from "@/lib/photos";
import type { Design } from "@/lib/types";

const text = (f: FormData, k: string) => String(f.get(k) ?? "");
const firstErrors = (error: z.ZodError) => Object.fromEntries(Object.entries(z.flattenError(error).fieldErrors).map(([k, v]) => [k, (v as string[])[0]]));
const OPEN = new Set(["draft", "in_review", "changes_requested"]);
type Result = { ok: boolean; message: string };

// What the form posts: the raw strings (echoed back on error) and the parsed design.
const readForm = (f: FormData) => {
  const colours = f.getAll("colour").map(String);
  const values: Record<string, string> = { ...Object.fromEntries(["title", "description", "productType", "suggestedPrice", "printFileUrl", "originality"].map((k) => [k, text(f, k)])), colours: colours.join("|") };
  return { values, parsed: designSchema.safeParse({ ...values, colours, originality: values.originality === "on" }) };
};

// A designer can only touch their own designs, and only while the design is theirs to work on.
async function ownDesign(designId: string, designerId: string): Promise<Design | null> {
  if (!z.uuid().safeParse(designId).success) return null;
  const design = await db().getDesign(designId);
  return design && design.designer_id === designerId ? design : null;
}

const refreshAdmin = () => revalidatePath("/admin", "layout");

export async function createDesign(_prev: FormState, formData: FormData): Promise<FormState> {
  const { designer } = await requireApprovedDesigner("/designer/designs/new");
  const { values, parsed } = readForm(formData);
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error), values };

  let id: string;
  try {
    const open = (await db().listDesignsByDesigner(designer.id)).filter((d) => OPEN.has(d.status)).length;
    if (open >= site.maxOpenDesigns) {
      return { message: `You have ${open} designs in progress. Finish, submit or delete one before starting another.`, values };
    }
    const created = await db().createDesign(designer.id, toDesignInput(parsed.data));
    if (parsed.data.originality) await db().patchDesign(created.id, { originality_confirmed_at: new Date().toISOString() });
    id = created.id;
  } catch (e) {
    console.error("[createDesign]", e);
    return { message: "We couldn't save your design. Please try again.", values };
  }
  redirect(`/designer/designs/${id}?new=1`);
}

export async function saveDesign(_prev: FormState, formData: FormData): Promise<FormState> {
  const { designer } = await requireApprovedDesigner("/designer/designs");
  const { values, parsed } = readForm(formData);
  const design = await ownDesign(text(formData, "designId"), designer.id);
  if (!design) return { message: "We couldn't find that design.", values };
  if (!designerCanEdit(design.status)) return { message: "This design can't be edited right now.", values };
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error), values };

  try {
    await db().patchDesign(design.id, { ...toDesignInput(parsed.data), originality_confirmed_at: parsed.data.originality ? (design.originality_confirmed_at ?? new Date().toISOString()) : null });
  } catch (e) {
    console.error("[saveDesign]", e);
    return { message: "We couldn't save your changes. Please try again.", values };
  }
  revalidatePath(`/designer/designs/${design.id}`);
  return { ok: true, message: "Saved.", values };
}

export async function addDesignImage(designId: string, formData: FormData): Promise<Result> {
  const { designer } = await requireApprovedDesigner("/designer/designs");
  const design = await ownDesign(designId, designer.id);
  if (!design) return { ok: false, message: "Design not found." };
  if (!designerCanEdit(design.status)) return { ok: false, message: "This design can't be edited right now." };
  if (design.images.length >= site.maxDesignImages) return { ok: false, message: `A design can have ${site.maxDesignImages} images. Remove one first.` };

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose an image first." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, message: "That image is too big (4 MB at most)." };
  try {
    await db().addDesignImage(design.id, await normalizePhoto(Buffer.from(await file.arrayBuffer())));
  } catch (e) {
    if (e instanceof BadPhotoError) return { ok: false, message: e.message };
    console.error("[addDesignImage]", e);
    return { ok: false, message: "Couldn't save the image." };
  }
  revalidatePath(`/designer/designs/${design.id}`);
  return { ok: true, message: "Image added." };
}

export async function removeDesignImage(designId: string, imageId: string): Promise<Result> {
  const { designer } = await requireApprovedDesigner("/designer/designs");
  const design = await ownDesign(designId, designer.id);
  if (!design || !z.uuid().safeParse(imageId).success) return { ok: false, message: "Image not found." };
  if (!designerCanEdit(design.status)) return { ok: false, message: "This design can't be edited right now." };
  try {
    await db().removeDesignImage(design.id, imageId);
  } catch (e) {
    console.error("[removeDesignImage]", e);
    return { ok: false, message: "Couldn't remove the image." };
  }
  revalidatePath(`/designer/designs/${design.id}`);
  return { ok: true, message: "Image removed." };
}

// Sends the design to the team. Re-checks everything on the server, whatever the page showed.
export async function submitDesign(designId: string): Promise<Result & { problems?: string[] }> {
  const { designer } = await requireApprovedDesigner("/designer/designs");
  const design = await ownDesign(designId, designer.id);
  if (!design) return { ok: false, message: "Design not found." };
  if (!canMove(design.status, "in_review") || !designerCanEdit(design.status)) return { ok: false, message: "This design has already been sent." };
  const problems = submitProblems(design);
  if (problems.length) return { ok: false, message: "A few things are missing.", problems };

  try {
    await db().patchDesign(design.id, { status: "in_review", submitted_at: new Date().toISOString() });
  } catch (e) {
    console.error("[submitDesign]", e);
    return { ok: false, message: "We couldn't send your design. Please try again." };
  }
  revalidatePath("/designer/designs", "layout");
  refreshAdmin();
  return { ok: true, message: "Sent for review." };
}

export async function deleteDesign(designId: string): Promise<Result> {
  const { designer } = await requireApprovedDesigner("/designer/designs");
  const design = await ownDesign(designId, designer.id);
  if (!design) return { ok: false, message: "Design not found." };
  if (!designerCanDelete(design.status)) return { ok: false, message: "Only drafts can be deleted." };
  try {
    await db().deleteDesign(design.id);
  } catch (e) {
    console.error("[deleteDesign]", e);
    return { ok: false, message: "We couldn't delete the design. Please try again." };
  }
  revalidatePath("/designer/designs", "layout");
  return { ok: true, message: "Design deleted." };
}

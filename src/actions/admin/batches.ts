"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { adminAction } from "@/lib/admin/guard";
import { batchSchema, BATCH_FLOW } from "@/lib/admin/schemas";
import { fromIstInput } from "@/lib/admin/dates";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/form-state";
import type { BatchStatus } from "@/lib/types";

const text = (f: FormData, k: string) => String(f.get(k) ?? "");
const firstErrors = (error: z.ZodError) => Object.fromEntries(Object.entries(z.flattenError(error).fieldErrors).map(([k, v]) => [k, (v as string[])[0]]));

// The storefront sells from exactly one open batch, so opening one closes the others.
async function closeOthers(exceptId: string) {
  const d = db();
  for (const b of await d.listBatches()) if (b.id !== exceptId && b.status === "open") await d.updateBatch(b.id, { status: "closed" });
}

const refresh = () => {
  updateTag("batches"); // the shop, product pages and checkout read the open batch through this tag
  revalidatePath("/admin", "layout");
};

function parse(formData: FormData) {
  const values = { name: text(formData, "name"), opens: text(formData, "opens_at"), closes: text(formData, "closes_at"), est: text(formData, "est_delivery") };
  const parsed = batchSchema.safeParse({ name: values.name, opens_at: fromIstInput(values.opens) ?? "", closes_at: fromIstInput(values.closes) ?? "", est_delivery: values.est });
  return { values: { name: values.name, opens_at: values.opens, closes_at: values.closes, est_delivery: values.est }, parsed };
}

export async function createBatch(_prev: FormState, formData: FormData): Promise<FormState> {
  return adminAction(async () => {
    const { values, parsed } = parse(formData);
    if (!parsed.success) return { ok: false, fieldErrors: firstErrors(parsed.error), values };
    const openNow = formData.get("open_now") === "on";
    try {
      const batch = await db().createBatch({ ...parsed.data, status: openNow ? "open" : "closed" });
      if (openNow) await closeOthers(batch.id);
    } catch (e) {
      console.error("[admin createBatch]", e);
      return { ok: false, message: "Couldn't create the batch.", values };
    }
    refresh();
    return { ok: true, message: `Created ${parsed.data.name}${openNow ? " and opened it for orders" : ""}.` };
  });
}

export async function updateBatch(_prev: FormState, formData: FormData): Promise<FormState> {
  return adminAction(async () => {
    const id = text(formData, "id");
    const { values, parsed } = parse(formData);
    if (!z.uuid().safeParse(id).success) return { ok: false, message: "Batch not found." };
    if (!parsed.success) return { ok: false, fieldErrors: firstErrors(parsed.error), values };
    try {
      await db().updateBatch(id, parsed.data);
    } catch (e) {
      console.error("[admin updateBatch]", e);
      return { ok: false, message: "Couldn't save the batch.", values };
    }
    refresh();
    return { ok: true, message: "Batch saved." };
  });
}

export async function setBatchStatus(batchId: string, status: BatchStatus) {
  return adminAction(async () => {
    if (!z.uuid().safeParse(batchId).success || !BATCH_FLOW.includes(status)) return { ok: false as const, message: "That isn't valid." };
    try {
      await db().updateBatch(batchId, { status });
      if (status === "open") await closeOthers(batchId);
    } catch (e) {
      console.error("[admin setBatchStatus]", e);
      return { ok: false as const, message: "Couldn't change the batch." };
    }
    refresh();
    return { ok: true as const, message: status === "open" ? "Batch opened. Any other open batch was closed." : `Batch marked ${status}.` };
  });
}

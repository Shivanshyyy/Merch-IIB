import { db } from "@/lib/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const notFound = () => new Response("Not found", { status: 404 });

// Serves one private design image if `allowed` says this caller may see it; otherwise a plain 404, so ids can't be probed.
export async function serveDesignImage(id: string, allowed: (designerId: string) => Promise<boolean>) {
  if (!UUID.test(id)) return notFound();
  try {
    const image = await db().getDesignImage(id);
    if (!image) return notFound();
    const design = await db().getDesign(image.designId);
    if (!design || !(await allowed(design.designer_id))) return notFound();
    return new Response(new Uint8Array(image.bytes), {
      headers: { "Content-Type": image.mime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
    });
  } catch (e) {
    console.error("[design-images]", e);
    return new Response("Couldn't load the image", { status: 500 });
  }
}

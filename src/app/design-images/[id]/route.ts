import { isAdmin } from "@/lib/admin/guard";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => new Response("Not found", { status: 404 });

// Design images are private until the design is published (then a copy goes to the shop photos): only the admin and
// the design's own designer can open them. Anyone else gets a 404, so ids can't be probed.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return notFound();
  try {
    const image = await db().getDesignImage(id);
    if (!image) return notFound();

    if (!(await isAdmin())) {
      const user = await getSessionUser();
      const design = user ? await db().getDesign(image.designId) : null;
      if (!user || !design || design.designer_id !== user.id) return notFound();
    }
    return new Response(new Uint8Array(image.bytes), {
      headers: { "Content-Type": image.mime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
    });
  } catch (e) {
    console.error("[design-images]", e);
    return new Response("Couldn't load the image", { status: 500 });
  }
}

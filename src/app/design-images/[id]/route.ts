import { getSessionUser } from "@/lib/auth/session";
import { notFound, serveDesignImage } from "@/lib/designer/serve-image";

// Design images are private until the design is published (then a copy goes to the shop photos). This route serves a
// designer their own; the admin has /admin/design-images, because the admin cookie is never sent outside /admin.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return notFound();
  return serveDesignImage(id, async (designerId) => designerId === user.id);
}

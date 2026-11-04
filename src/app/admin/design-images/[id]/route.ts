import { isAdmin } from "@/lib/admin/guard";
import { notFound, serveDesignImage } from "@/lib/designer/serve-image";

// The admin's copy of /design-images/[id]: it lives under /admin because that is the only path the admin cookie reaches.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return notFound();
  const { id } = await params;
  return serveDesignImage(id, async () => true);
}

import { db } from "@/lib/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => new Response("Not found", { status: 404 });

// Serves a photo the admin uploaded. The id is random and the bytes never change, so browsers and the CDN may keep it for good.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return notFound();
  try {
    const photo = await db().getPhoto(id);
    if (!photo) return notFound();
    return new Response(new Uint8Array(photo.bytes), {
      headers: { "Content-Type": photo.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch (e) {
    console.error("[photos]", e);
    return new Response("Couldn't load the photo", { status: 500 });
  }
}

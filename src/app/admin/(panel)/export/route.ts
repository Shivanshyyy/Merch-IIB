import { isAdmin } from "@/lib/admin/guard";
import { toCsv, vendorRows } from "@/lib/admin/export";
import { db } from "@/lib/db";
import { slugify } from "@/lib/format";

// The vendor CSV: paid orders only, and only the columns the vendor needs.
export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const id = new URL(req.url).searchParams.get("batch") ?? "";
  const d = db();
  const batch = await d.getBatch(id).catch(() => null);
  if (!batch) return new Response("Batch not found", { status: 404 });

  const csv = toCsv(vendorRows(await d.listOrdersForBatch(batch.id)));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugify(batch.name) || "batch"}-vendor-sheet.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

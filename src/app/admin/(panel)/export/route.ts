import { isAdmin } from "@/lib/admin/guard";
import { filterLines, parseVendorFilter, toCsv, toRow, vendorLines } from "@/lib/admin/export";
import { db } from "@/lib/db";
import { slugify } from "@/lib/format";

// The vendor CSV: paid orders only, only the columns the vendor needs, optionally for one garment kind or product.
export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const params = new URL(req.url).searchParams;
  const id = params.get("batch") ?? "";
  const d = db();
  const batch = await d.getBatch(id).catch(() => null);
  if (!batch) return new Response("Batch not found", { status: 404 });

  const kinds = Object.fromEntries((await d.listAllProducts()).map((p) => [p.slug, p.type]));
  const lines = vendorLines(await d.listOrdersForBatch(batch.id), kinds);
  const filter = parseVendorFilter(lines, params.get("type") ?? undefined, params.get("product") ?? undefined);
  const csv = toCsv(filterLines(lines, filter).map(toRow));
  const part = slugify(filter.slug ?? filter.kind ?? "");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugify(batch.name) || "batch"}${part ? `-${part}` : ""}-vendor-sheet.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

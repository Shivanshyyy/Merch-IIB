import type { Metadata } from "next";
import { Suspense } from "react";
import { BatchSelect } from "@/components/admin/BatchSelect";
import { requireAdmin } from "@/lib/admin/guard";
import { pivot, vendorRows } from "@/lib/admin/export";
import type { SearchParams } from "@/lib/admin/params";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Vendor sheet" };

type Props = { searchParams: Promise<SearchParams> };

export default function VendorPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<div className="skeleton h-96" aria-hidden />}>
      <Vendor searchParams={searchParams} />
    </Suspense>
  );
}

async function Vendor({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const requested = typeof sp.batch === "string" ? sp.batch : undefined;
  const d = db();
  const batches = await d.listBatches();
  const batch = batches.find((b) => b.id === requested) ?? batches.find((b) => b.status === "open") ?? batches[0];

  if (!batch) {
    return (
      <div className="grid gap-4">
        <h1 className="t-display text-3xl">Vendor sheet</h1>
        <p className="admin-card p-10 text-center text-muted">Create a batch first.</p>
      </div>
    );
  }

  const rows = vendorRows(await d.listOrdersForBatch(batch.id));
  const table = pivot(rows);

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-display text-3xl">Vendor sheet</h1>
          <p className="admin-label mt-2">Paid, non-cancelled orders in {batch.name}. Only product, colour, size, name, quantity and order code. No phone, email or payment data.</p>
        </div>
        <BatchSelect basePath="/admin/vendor" value={batch.id} batches={batches.map((b) => ({ id: b.id, name: b.name, status: b.status }))} />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <a href={`/admin/export?batch=${batch.id}`} download className="btn btn-sm">
          <span className="btn-fill" aria-hidden />
          <span>Download CSV</span>
        </a>
        <p className="admin-label">
          {table.grandTotal} {table.grandTotal === 1 ? "unit" : "units"} · {rows.length} {rows.length === 1 ? "line" : "lines"}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="admin-card p-10 text-center text-muted">No paid orders in this batch yet. Verify payments and they appear here.</p>
      ) : (
        <>
          <section aria-labelledby="pivot-h" className="admin-card overflow-x-auto">
            <h2 id="pivot-h" className="px-5 pt-5 text-[1rem] font-semibold">
              Units by product, colour and size
            </h2>
            <table className="admin-table mt-3">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Colour</th>
                  {table.sizes.map((s) => (
                    <th key={s} className="num">
                      {s}
                    </th>
                  ))}
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r) => (
                  <tr key={`${r.product}-${r.colour}`}>
                    <td>{r.product}</td>
                    <td>{r.colour}</td>
                    {table.sizes.map((s) => (
                      <td key={s} className="num">
                        {r.counts[s] ?? <span className="text-muted">·</span>}
                      </td>
                    ))}
                    <td className="num font-semibold">{r.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} className="font-semibold">
                    Total
                  </td>
                  {table.sizes.map((s) => (
                    <td key={s} className="num font-semibold">
                      {table.totals[s]}
                    </td>
                  ))}
                  <td className="num font-semibold">{table.grandTotal}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section aria-labelledby="lines-h" className="admin-card overflow-x-auto">
            <h2 id="lines-h" className="px-5 pt-5 text-[1rem] font-semibold">
              What the CSV contains
            </h2>
            <table className="admin-table mt-3">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Colour</th>
                  <th>Size</th>
                  <th>Name</th>
                  <th className="num">Qty</th>
                  <th>Order</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.product}</td>
                    <td>{r.colour}</td>
                    <td className="mono">{r.size}</td>
                    <td className="mono">{r.name || <span className="text-muted">—</span>}</td>
                    <td className="num">{r.quantity}</td>
                    <td className="mono">{r.orderCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

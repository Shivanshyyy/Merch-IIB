import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BatchForm } from "@/components/admin/BatchForm";
import { BatchStatusButtons } from "@/components/admin/BatchStatusButtons";
import { FreshOnVisit } from "@/components/ui/FreshOnVisit";
import { fmtShort, inDays, toIstInput } from "@/lib/admin/dates";
import { requireAdmin } from "@/lib/admin/guard";
import { computeStats } from "@/lib/admin/stats";
import { db } from "@/lib/db";
import { inr } from "@/lib/format";

export const metadata: Metadata = { title: "Batches" };

export default function BatchesPage() {
  return (
    <Suspense fallback={<div className="skeleton h-96" aria-hidden />}>
      <Batches />
    </Suspense>
  );
}

async function Batches() {
  await requireAdmin();
  const d = db();
  const [batches, orders] = await Promise.all([d.listBatches(), d.listOrdersForBatch()]);
  const defaults = { name: `Batch ${String(batches.length + 1).padStart(2, "0")}`, opens: toIstInput(inDays(0)), closes: toIstInput(inDays(14)), est: "" };

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="t-display text-3xl">Batches</h1>
        <p className="admin-label mt-2">Customers order from the one open batch. When it closes, send the vendor sheet.</p>
      </div>

      <details className="admin-card p-5" open={batches.length === 0}>
        <summary className="cursor-pointer text-[1rem] font-semibold">New batch</summary>
        <div className="mt-5">
          <FreshOnVisit>
            <BatchForm defaults={defaults} />
          </FreshOnVisit>
        </div>
      </details>

      <ul className="grid gap-4">
        {batches.map((b) => {
          const stats = computeStats(orders.filter((o) => o.batch_id === b.id));
          return (
            <li key={b.id} className="admin-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-[1.15rem] font-semibold">
                    {b.name}
                    {b.status === "open" && <span className="ml-3 rounded-full bg-[#0ca30c]/20 px-2.5 py-0.5 align-middle text-[0.75rem] font-normal text-fg">Accepting orders</span>}
                  </h2>
                  <p className="admin-label mt-1">
                    {fmtShort(b.opens_at)} → {fmtShort(b.closes_at)} (IST){b.est_delivery ? ` · Delivery: ${b.est_delivery}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/admin/orders?batch=${b.id}`} className="btn btn-ghost btn-sm">
                    <span className="btn-fill" aria-hidden />
                    <span>Orders</span>
                  </Link>
                  <Link href={`/admin/vendor?batch=${b.id}`} className="btn btn-ghost btn-sm">
                    <span className="btn-fill" aria-hidden />
                    <span>Vendor sheet</span>
                  </Link>
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ["Orders", stats.orders],
                  ["Paid", stats.verified],
                  ["Revenue", inr(stats.verifiedRevenue)],
                  ["Items to make", stats.items],
                ].map(([k, v]) => (
                  <div key={String(k)}>
                    <dt className="admin-label">{k}</dt>
                    <dd className="mt-1 text-[1.4rem] font-semibold leading-none">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-5 border-t border-line pt-5">
                <p className="admin-label mb-3">Status</p>
                <BatchStatusButtons id={b.id} status={b.status} />
              </div>

              <details className="mt-5 border-t border-line pt-4">
                <summary className="admin-label cursor-pointer py-1 hover:text-fg">Edit name, dates and delivery</summary>
                <div className="mt-4">
                  <FreshOnVisit>
                    <BatchForm batch={b} defaults={{ name: b.name, opens: toIstInput(b.opens_at), closes: toIstInput(b.closes_at), est: b.est_delivery }} />
                  </FreshOnVisit>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SizeBars } from "@/components/admin/SizeBars";
import { BatchSelect } from "@/components/admin/BatchSelect";
import { StatTile } from "@/components/admin/StatTile";
import { PaymentChip } from "@/components/admin/status";
import { requireAdmin } from "@/lib/admin/guard";
import { fmtShort } from "@/lib/admin/dates";
import type { SearchParams } from "@/lib/admin/params";
import { computeStats } from "@/lib/admin/stats";
import { db } from "@/lib/db";
import { inr } from "@/lib/format";
import { getSettingsFresh } from "@/lib/settings";
import { setupChecklist } from "@/lib/settings-schema";

export const metadata: Metadata = { title: "Dashboard" };

type Props = { searchParams: Promise<SearchParams> };

export default function DashboardPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<div className="skeleton h-96" aria-hidden />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const requested = typeof sp.batch === "string" ? sp.batch : undefined;

  const d = db();
  const [batches, settings] = await Promise.all([d.listBatches(), getSettingsFresh()]);
  const active = batches.find((b) => b.status === "open") ?? null;
  // Default to the open batch; "all" shows everything.
  const scope = requested === "all" ? undefined : batches.find((b) => b.id === requested)?.id ?? active?.id;
  const scoped = batches.find((b) => b.id === scope) ?? null;

  const orders = await d.listOrdersForBatch(scope);
  const stats = computeStats(orders);
  const q = scope ? `&batch=${scope}` : "";
  const attention = orders
    .filter((o) => o.payment_status === "pending" && o.order_status !== "cancelled")
    .sort((a, b) => Number(!!b.utr) - Number(!!a.utr) || a.created_at.localeCompare(b.created_at)) // with a UTR first, then longest-waiting
    .slice(0, 6);
  const checklist = setupChecklist(settings).filter((i) => !i.done);

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-display text-3xl">Dashboard</h1>
          <p className="admin-label mt-2">{scoped ? `${scoped.name} · ${scoped.status}` : "All batches"}</p>
        </div>
        <BatchSelect batches={batches.map((b) => ({ id: b.id, name: b.name, status: b.status }))} value={scope ?? "all"} />
      </div>

      {checklist.length > 0 && (
        <section aria-labelledby="setup-h" className="admin-card border-accent-2/50 p-5">
          <h2 id="setup-h" className="text-[1rem] font-semibold">
            Finish setting up before you launch
          </h2>
          <p className="admin-label mt-1">These are still on placeholder values. Customers would see them.</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {checklist.map((i) => (
              <li key={i.key} className="flex items-start gap-3 text-[0.9rem]">
                <span aria-hidden className="mt-1 size-2 shrink-0 rounded-full bg-accent-2" />
                <span>
                  <strong className="font-medium">{i.label}</strong>
                  <span className="admin-label block">{i.hint}</span>
                </span>
              </li>
            ))}
          </ul>
          <Link href="/admin/settings" className="btn btn-sm mt-5 inline-flex">
            <span className="btn-fill" aria-hidden />
            <span>Open settings</span>
          </Link>
        </section>
      )}

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:grid-rows-2">
        <div className="col-span-2 lg:row-span-2">
          <StatTile hero label="Verified revenue" value={inr(stats.verifiedRevenue)} sub={`${stats.verified} paid ${stats.verified === 1 ? "order" : "orders"}${stats.pendingAmount ? ` · ${inr(stats.pendingAmount)} still to verify` : ""}`} />
        </div>
        <StatTile label="Orders" value={stats.orders} sub={stats.cancelled ? `${stats.cancelled} cancelled` : "none cancelled"} href={`/admin/orders?${q.slice(1)}`} />
        <StatTile label="Pending verifications" value={stats.pending} sub={stats.pending ? "waiting on you" : "all caught up"} href={`/admin/orders?payment=pending${q}`} />
        <StatTile label="Open refunds" value={stats.refundsOpen} sub={stats.refunded ? `${stats.refunded} refunded (${inr(stats.refundedAmount)})` : "none refunded"} href={`/admin/orders?refund=open${q}`} />
        <StatTile label="Items to make" value={stats.items} sub="paid, not cancelled" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="sizes-h" className="admin-card p-5">
          <h2 id="sizes-h" className="text-[1rem] font-semibold">
            Items per size
          </h2>
          <p className="admin-label mb-5 mt-1">Paid, not cancelled</p>
          <SizeBars data={stats.itemsBySize} />
        </section>

        <section aria-labelledby="todo-h" className="admin-card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="todo-h" className="text-[1rem] font-semibold">
              Needs verifying
            </h2>
            {stats.pending > attention.length && (
              <Link href={`/admin/orders?payment=pending${q}`} className="admin-label underline underline-offset-4 hover:text-fg">
                See all {stats.pending}
              </Link>
            )}
          </div>
          {attention.length === 0 ? (
            <p className="admin-label mt-5 rounded border border-dashed border-line p-6 text-center">Nothing waiting. Every placed order has been verified or rejected.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {attention.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders?order=${o.code}${q}`} className="flex min-h-14 items-center justify-between gap-3 py-2 hover:text-accent-2">
                    <span className="min-w-0">
                      <span className="mono text-[0.95rem]">{o.code}</span>
                      <span className="admin-label block truncate">
                        {o.full_name} · {fmtShort(o.created_at)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="mono">{inr(o.total_inr)}</span>
                      {o.utr ? <span className="admin-label">UTR given</span> : <PaymentChip status={o.payment_status} />}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {active && (
        <section aria-labelledby="batch-h" className="admin-card flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h2 id="batch-h" className="text-[1rem] font-semibold">
              {active.name} is open
            </h2>
            <p className="admin-label mt-1">
              Closes {fmtShort(active.closes_at)}
              {active.est_delivery ? ` · Delivery: ${active.est_delivery}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/batches" className="btn btn-ghost btn-sm">
              <span className="btn-fill" aria-hidden />
              <span>Manage batches</span>
            </Link>
            <Link href={`/admin/vendor?batch=${active.id}`} className="btn btn-ghost btn-sm">
              <span className="btn-fill" aria-hidden />
              <span>Vendor sheet</span>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

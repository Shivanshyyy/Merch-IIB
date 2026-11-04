import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DesignerChip } from "@/components/admin/status";
import { requireAdmin } from "@/lib/admin/guard";
import type { SearchParams } from "@/lib/admin/params";
import { db } from "@/lib/db";
import { DESIGNER_STATUS_LABEL } from "@/lib/designer/design-flow";
import { summarizeDesigner } from "@/lib/designer/sales";
import { fmtDay, inr } from "@/lib/format";
import type { DesignerStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Designers" };

type Props = { searchParams: Promise<SearchParams> };
const STATUSES: DesignerStatus[] = ["pending", "approved", "suspended", "rejected"];

export default function DesignersPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<div className="skeleton h-96" aria-hidden />}>
      <Designers searchParams={searchParams} />
    </Suspense>
  );
}

async function Designers({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 60);
  const status = STATUSES.find((s) => s === sp.status);
  const d = db();
  const [all, orders, payouts] = await Promise.all([d.listDesigners(), d.listOrdersForBatch(), d.listPayouts()]);

  const term = q.toLowerCase();
  const rows = all
    .filter((x) => (!status || x.status === status) && (!term || [x.full_name, x.email, x.phone].some((v) => v.toLowerCase().includes(term))))
    .map((x) => ({ ...x, sum: summarizeDesigner(orders.filter((o) => o.items.some((i) => i.designer?.id === x.id)), x.id, payouts) }))
    .sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || b.created_at.localeCompare(a.created_at)); // applications waiting first

  const count = (s: DesignerStatus) => all.filter((x) => x.status === s).length;
  const tab = (label: string, value: DesignerStatus | undefined, n: number) => {
    const active = value === status;
    const href = `/admin/designers${value ? `?status=${value}` : ""}`;
    return (
      <Link key={label} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-2 border-b-2 px-3 text-[0.9rem] ${active ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"}`}>
        {label} <span className="mono text-[0.75rem]">{n}</span>
      </Link>
    );
  };

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="t-display text-3xl">Designers</h1>
        <p className="admin-label mt-2">Approve applications, set each designer&apos;s commission, and record payouts.</p>
      </div>

      <nav aria-label="Designer status" className="flex flex-wrap border-b border-line">
        {tab("All", undefined, all.length)}
        {STATUSES.map((s) => tab(DESIGNER_STATUS_LABEL[s], s, count(s)))}
      </nav>

      <form method="get" action="/admin/designers" role="search" className="flex flex-wrap gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <label className="min-w-64 flex-1">
          <span className="sr-only">Search designers</span>
          <input type="search" name="q" defaultValue={q} placeholder="Search name, email or phone" className="input !min-h-11" />
        </label>
        <button type="submit" className="btn btn-quiet btn-sm">
          <span className="btn-fill" aria-hidden />
          <span>Search</span>
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="admin-card p-10 text-center text-muted">{q || status ? "Nobody matches." : "No designers have applied yet."}</p>
      ) : (
        <>
          <div className="admin-card hidden overflow-x-auto md:block">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th className="num">Rate</th>
                  <th className="num">Units sold</th>
                  <th className="num">Earned</th>
                  <th className="num">Balance</th>
                  <th>Applied</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <Link href={`/admin/designers/${x.id}`} className="underline-offset-4 hover:underline">
                        {x.full_name}
                      </Link>
                      <p className="admin-label mt-0.5 truncate">{x.email}</p>
                    </td>
                    <td>
                      <DesignerChip status={x.status} />
                    </td>
                    <td className="num mono">{x.commission_pct === null ? "—" : `${x.commission_pct}%`}</td>
                    <td className="num">{x.sum.unitsSold}</td>
                    <td className="num mono">{inr(x.sum.earnedInr)}</td>
                    <td className="num mono">{inr(Math.max(0, x.sum.balanceInr))}</td>
                    <td className="whitespace-nowrap text-muted">{fmtDay(x.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid gap-2 md:hidden">
            {rows.map((x) => (
              <li key={x.id}>
                <Link href={`/admin/designers/${x.id}`} className="admin-card block p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{x.full_name}</p>
                    <DesignerChip status={x.status} />
                  </div>
                  <p className="admin-label mt-0.5 truncate">{x.email}</p>
                  <p className="admin-label mt-2">
                    {x.commission_pct === null ? "No rate yet" : `${x.commission_pct}%`} · {x.sum.unitsSold} sold · {inr(Math.max(0, x.sum.balanceInr))} owed
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

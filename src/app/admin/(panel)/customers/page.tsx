import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/guard";
import { isLive } from "@/lib/admin/stats";
import type { SearchParams } from "@/lib/admin/params";
import { db } from "@/lib/db";
import { fmtDay, inr } from "@/lib/format";

export const metadata: Metadata = { title: "Customers" };

type Props = { searchParams: Promise<SearchParams> };

export default function CustomersPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<div className="skeleton h-96" aria-hidden />}>
      <Customers searchParams={searchParams} />
    </Suspense>
  );
}

async function Customers({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 60);
  const d = db();
  const [profiles, orders] = await Promise.all([d.listProfiles(q, 100), d.listOrdersForBatch()]);

  const stats = new Map<string, { count: number; paid: number }>();
  for (const o of orders) {
    if (!o.user_id) continue;
    const s = stats.get(o.user_id) ?? { count: 0, paid: 0 };
    s.count++;
    if (isLive(o)) s.paid += o.total_inr;
    stats.set(o.user_id, s);
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="t-display text-3xl">Customers</h1>
        <p className="admin-label mt-2">{profiles.length} {profiles.length === 1 ? "customer" : "customers"}{q ? ` matching “${q}”` : ""}</p>
      </div>

      <form method="get" action="/admin/customers" role="search" className="flex flex-wrap gap-2">
        <label className="min-w-64 flex-1">
          <span className="sr-only">Search customers</span>
          <input type="search" name="q" defaultValue={q} placeholder="Search name, email, roll no. or phone" className="input !min-h-11" />
        </label>
        <button type="submit" className="btn btn-quiet btn-sm">
          <span className="btn-fill" aria-hidden />
          <span>Search</span>
        </button>
        {q && (
          <Link href="/admin/customers" className="admin-label flex min-h-10 items-center px-3 underline underline-offset-4 hover:text-fg">
            Clear
          </Link>
        )}
      </form>

      {profiles.length === 0 ? (
        <p className="admin-card p-10 text-center text-muted">{q ? "Nobody matches that search." : "No customers have signed up yet."}</p>
      ) : (
        <>
          <div className="admin-card hidden overflow-x-auto md:block">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Roll no.</th>
                  <th className="num">Orders</th>
                  <th className="num">Paid</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const s = stats.get(p.id);
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/admin/customers/${p.id}`} className="underline-offset-4 hover:underline">
                          {p.full_name}
                        </Link>
                      </td>
                      <td className="max-w-64 truncate text-muted">{p.email}</td>
                      <td className="mono">{p.phone}</td>
                      <td className="mono text-muted">{p.roll_no ?? "—"}</td>
                      <td className="num">{s?.count ?? 0}</td>
                      <td className="num mono">{s?.paid ? inr(s.paid) : "—"}</td>
                      <td className="whitespace-nowrap text-muted">{fmtDay(p.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="grid gap-2 md:hidden">
            {profiles.map((p) => {
              const s = stats.get(p.id);
              return (
                <li key={p.id}>
                  <Link href={`/admin/customers/${p.id}`} className="admin-card block p-4">
                    <p className="font-medium">{p.full_name}</p>
                    <p className="admin-label mt-0.5 truncate">{p.email}</p>
                    <p className="admin-label mt-2">
                      <span className="mono">{p.phone}</span> · {s?.count ?? 0} {s?.count === 1 ? "order" : "orders"}{s?.paid ? ` · ${inr(s.paid)} paid` : ""}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

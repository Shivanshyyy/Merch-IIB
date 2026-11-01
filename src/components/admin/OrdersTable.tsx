"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FreebieChip, OrderChip, PaymentChip, RefundChip, rowTone } from "@/components/admin/status";
import { fmtShort } from "@/lib/admin/dates";
import { inr } from "@/lib/format";
import type { Order } from "@/lib/types";

const itemsSummary = (o: Order) => {
  const n = o.items.reduce((s, i) => s + i.qty, 0);
  return `${n} ${n === 1 ? "item" : "items"} · ${[...new Set(o.items.map((i) => `${i.colorway} ${i.size}`))].slice(0, 2).join(", ")}${o.items.length > 2 ? "…" : ""}`;
};

// Desktop gets a table; a phone gets cards. Same rows, same links.
export function OrdersTable({ orders, hrefs, activeCode }: { orders: Order[]; hrefs: Record<string, string>; activeCode?: string }) {
  const router = useRouter();

  if (!orders.length) {
    return <p className="admin-card p-10 text-center text-muted">No orders match. Try clearing a filter.</p>;
  }

  return (
    <>
      <div className="admin-card hidden overflow-x-auto md:block">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Placed</th>
              <th>Order</th>
              <th>Customer</th>
              <th>Items</th>
              <th className="num">Total</th>
              <th>Payment</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} onClick={() => router.push(hrefs[o.code], { scroll: false })} className={`row-tone tone-${rowTone(o)} cursor-pointer transition-colors hover:bg-[rgba(237,235,230,0.05)] ${activeCode === o.code ? "!bg-[rgba(237,235,230,0.09)]" : ""}`}>
                <td className="whitespace-nowrap text-muted">{fmtShort(o.created_at)}</td>
                <td>
                  <Link href={hrefs[o.code]} scroll={false} className="mono underline-offset-4 hover:underline" onClick={(e) => e.stopPropagation()}>
                    {o.code}
                  </Link>
                  {o.utr && <span className="admin-label ml-2" title={`UTR ${o.utr}`}>UTR</span>}
                </td>
                <td>
                  <span className="block">{o.full_name}</span>
                  <span className="admin-label block max-w-56 truncate">{o.email}</span>
                </td>
                <td className="max-w-56 truncate text-muted">{itemsSummary(o)}</td>
                <td className="num mono">{inr(o.total_inr)}</td>
                <td>
                  <div className="grid gap-1">
                    <PaymentChip status={o.payment_status} />
                    {o.freebie && <FreebieChip />}
                  </div>
                </td>
                <td>
                  <div className="grid gap-1">
                    <OrderChip status={o.order_status} />
                    {o.refund_status !== "none" && <RefundChip status={o.refund_status} />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-2 md:hidden">
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={hrefs[o.code]} scroll={false} className={`row-tone tone-${rowTone(o)} admin-card block p-4 ${activeCode === o.code ? "!bg-[rgba(237,235,230,0.09)]" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="mono text-[1.05rem]">{o.code}</p>
                  <p className="truncate">{o.full_name}</p>
                </div>
                <p className="mono shrink-0 text-[1.05rem]">{inr(o.total_inr)}</p>
              </div>
              <p className="admin-label mt-1">
                {fmtShort(o.created_at)} · {itemsSummary(o)}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                <PaymentChip status={o.payment_status} />
                {o.freebie && <FreebieChip />}
                <OrderChip status={o.order_status} />
                {o.refund_status !== "none" && <RefundChip status={o.refund_status} />}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Stat } from "@/components/designer/Stat";
import { requireApprovedDesigner } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { summarizeDesigner, type SaleState } from "@/lib/designer/sales";
import { fmtDate, inr } from "@/lib/format";

export const metadata: Metadata = { title: "Earnings", robots: { index: false } };

const STATE: Record<SaleState, string> = { counted: "Counted", pending: "Awaiting payment", void: "Cancelled or refunded" };

export default function EarningsPage() {
  return (
    <Suspense fallback={<div className="skeleton h-96 min-h-[calc(100svh-20rem)]" aria-hidden />}>
      <Earnings />
    </Suspense>
  );
}

async function Earnings() {
  const { designer } = await requireApprovedDesigner("/designer/earnings");
  const d = db();
  const [orders, payouts] = await Promise.all([d.listOrdersWithDesigner(designer.id), d.listPayouts(designer.id)]);
  const sum = summarizeDesigner(orders, designer.id, payouts);

  return (
    <>
      <p className="label">[ Earnings ]</p>
      <h1 className="t-display t-h1 mt-4">What you&apos;ve earned</h1>
      <p className="mt-6 max-w-xl text-muted">
        You earn {designer.commission_pct}% of the profit on every piece sold. A sale counts once the buyer&apos;s payment is confirmed, and stops counting if the order is cancelled or refunded.
      </p>

      <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Commission earned" value={inr(sum.earnedInr)} />
        <Stat label="Pieces sold" value={sum.unitsSold} sub={sum.unitsPending ? `${sum.unitsPending} awaiting payment` : undefined} />
        <Stat label="Paid to you" value={inr(sum.paidInr)} />
        <Stat label="Still to be paid" value={inr(Math.max(0, sum.balanceInr))} />
      </div>

      <section aria-labelledby="by-h" className="mt-14">
        <h2 id="by-h" className="label text-fg">
          [ By design ]
        </h2>
        {sum.byProduct.length === 0 ? (
          <p className="mt-4 text-muted">No sales yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-[0.95rem]">
              <thead>
                <tr className="label border-b border-line">
                  <th className="py-3 pr-4 font-normal">Design</th>
                  <th className="py-3 pr-4 text-right font-normal">Sold</th>
                  <th className="py-3 pr-4 text-right font-normal">Waiting</th>
                  <th className="py-3 text-right font-normal">Earned</th>
                </tr>
              </thead>
              <tbody>
                {sum.byProduct.map((p) => (
                  <tr key={p.productId} className="border-b border-line">
                    <td className="py-3 pr-4">{p.productName}</td>
                    <td className="mono py-3 pr-4 text-right">{p.units}</td>
                    <td className="mono py-3 pr-4 text-right text-muted">{p.pendingUnits}</td>
                    <td className="mono py-3 text-right">{inr(p.earnedInr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="hist-h" className="mt-14">
        <h2 id="hist-h" className="label text-fg">
          [ Every sale ]
        </h2>
        {sum.sales.length === 0 ? (
          <p className="mt-4 text-muted">Nothing yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-[0.95rem]">
              <thead>
                <tr className="label border-b border-line">
                  <th className="py-3 pr-4 font-normal">Date</th>
                  <th className="py-3 pr-4 font-normal">Piece</th>
                  <th className="py-3 pr-4 text-right font-normal">Qty</th>
                  <th className="py-3 pr-4 font-normal">Status</th>
                  <th className="py-3 text-right font-normal">Commission</th>
                </tr>
              </thead>
              <tbody>
                {sum.sales.map((x, i) => (
                  <tr key={i} className={`border-b border-line ${x.state === "void" ? "text-muted" : ""}`}>
                    <td className="py-3 pr-4 whitespace-nowrap">{fmtDate(x.date)}</td>
                    <td className="py-3 pr-4">
                      {x.productName} <span className="text-muted">· {x.colorway} · {x.size}</span>
                    </td>
                    <td className="mono py-3 pr-4 text-right">{x.qty}</td>
                    <td className="py-3 pr-4">{STATE[x.state]}</td>
                    <td className={`mono py-3 text-right ${x.state === "void" ? "line-through" : ""}`}>{inr(x.commissionInr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="pay-h" className="mt-14">
        <h2 id="pay-h" className="label text-fg">
          [ Payouts ]
        </h2>
        {payouts.length === 0 ? (
          <p className="mt-4 text-muted">Nothing has been paid out yet. The team records each payout here when it&apos;s sent{designer.upi_id ? ` to ${designer.upi_id}` : ""}.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="mono">{inr(p.amount_inr)}</span>
                <span className="text-muted">
                  {fmtDate(p.paid_at)}
                  {p.reference ? ` · ${p.reference}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        {!designer.upi_id && <p className="mt-4 text-[0.95rem] text-muted">Add your UPI ID in your <Link href="/designer/profile" className="underline underline-offset-4">profile</Link> so the team knows where to send it.</p>}
      </section>
    </>
  );
}

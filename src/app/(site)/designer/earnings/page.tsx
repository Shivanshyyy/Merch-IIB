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
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {sum.byProduct.map((p) => (
              <li key={p.productId} className="grid grid-cols-[1fr_auto_5rem] items-baseline gap-x-4 py-3">
                <span>
                  {p.productName}
                  {p.pendingUnits > 0 && <span className="label mt-1 block normal-case tracking-normal">{p.pendingUnits} waiting for payment</span>}
                </span>
                <span className="mono">{p.units} sold</span>
                <span className="mono text-right">{inr(p.earnedInr)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="hist-h" className="mt-14">
        <h2 id="hist-h" className="label text-fg">
          [ Every sale ]
        </h2>
        {sum.sales.length === 0 ? (
          <p className="mt-4 text-muted">Nothing yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {sum.sales.map((x, i) => (
              <li key={i} className={`grid grid-cols-[1fr_auto] items-baseline gap-x-4 py-3 ${x.state === "void" ? "text-muted" : ""}`}>
                <span>
                  {x.productName}{" "}
                  <span className="text-muted">
                    · {x.colorway} · {x.size} · ×{x.qty}
                  </span>
                  <span className="label mt-1 block normal-case tracking-normal">
                    {fmtDate(x.date)} · {STATE[x.state]}
                  </span>
                </span>
                <span className={`mono ${x.state === "void" ? "line-through" : ""}`}>{inr(x.commissionInr)}</span>
              </li>
            ))}
          </ul>
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

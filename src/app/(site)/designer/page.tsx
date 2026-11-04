import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { DesignChip } from "@/components/admin/status";
import { Stat } from "@/components/designer/Stat";
import { StatusPanel } from "@/components/designer/StatusPanel";
import { Button } from "@/components/ui/Button";
import { requireDesigner } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { summarizeDesigner } from "@/lib/designer/sales";
import { fmtDate, inr } from "@/lib/format";
import { designImageUrl } from "@/lib/photos";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Designer dashboard", robots: { index: false } };

export default function DesignerDashboardPage() {
  return (
    <Suspense fallback={<div className="skeleton h-96 min-h-[calc(100svh-20rem)]" aria-hidden />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const { profile, designer } = await requireDesigner("/designer");
  const settings = await getSettings();
  if (designer.status !== "approved" || designer.commission_pct === null) return <StatusPanel designer={designer} settings={settings} />;

  const d = db();
  const [designs, orders, payouts] = await Promise.all([d.listDesignsByDesigner(designer.id), d.listOrdersWithDesigner(designer.id), d.listPayouts(designer.id)]);
  const sum = summarizeDesigner(orders, designer.id, payouts);
  const soldBy = new Map(sum.byProduct.map((p) => [p.productId, p]));
  const attention = designs.filter((x) => x.status === "changes_requested");
  const recent = sum.sales.filter((x) => x.state !== "void").slice(0, 5);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">[ Dashboard ]</p>
          <h1 className="t-display t-h1 mt-4">Hi, {profile.full_name.split(" ")[0]}</h1>
        </div>
        <Button href="/designer/designs/new">New design</Button>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Commission earned" value={inr(sum.earnedInr)} />
        <Stat label="Pieces sold" value={sum.unitsSold} />
        <Stat label="Your commission" value={`${designer.commission_pct}%`} sub="of profit on each piece" />
        <Stat label="Paid to you" value={inr(sum.paidInr)} />
        <Stat label="Still to be paid" value={inr(Math.max(0, sum.balanceInr))} />
      </div>
      {sum.unitsPending > 0 && (
        <p className="mt-4 text-[0.95rem] text-muted">
          {sum.unitsPending} {sum.unitsPending === 1 ? "piece is" : "pieces are"} waiting for the buyer&apos;s payment to be confirmed. They count as soon as it is.
        </p>
      )}

      {attention.length > 0 && (
        <section aria-labelledby="attn-h" className="mt-10 border border-fg p-5">
          <h2 id="attn-h" className="label text-fg">
            [ The team asked for changes ]
          </h2>
          <ul className="mt-3 grid gap-2">
            {attention.map((x) => (
              <li key={x.id}>
                <Link href={`/designer/designs/${x.id}`} className="underline underline-offset-4 hover:text-muted">
                  {x.title}
                </Link>
                {x.review_note && <span className="text-muted"> — {x.review_note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="designs-h" className="mt-14">
        <div className="flex items-end justify-between gap-4">
          <h2 id="designs-h" className="label text-fg">
            [ Your designs ]
          </h2>
          <Link href="/designer/designs" className="label underline underline-offset-4 hover:text-fg">
            See all
          </Link>
        </div>
        {designs.length === 0 ? (
          <p className="mt-4 border border-dashed border-line p-8 text-center text-muted">No designs yet. Upload your first one.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {designs.slice(0, 8).map((x) => {
              const s = x.product_id ? soldBy.get(x.product_id) : undefined;
              return (
                <li key={x.id}>
                  <Link href={`/designer/designs/${x.id}`} className="grid grid-cols-[56px_1fr_auto] items-center gap-4 py-3">
                    <span className="relative block aspect-[4/5] overflow-hidden border border-line bg-bg-2">{x.images[0] && <Image src={designImageUrl(x.images[0])} alt="" fill unoptimized sizes="56px" className="object-cover" />}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{x.title}</span>
                      <span className="mt-1 block">
                        <DesignChip status={x.status} />
                      </span>
                    </span>
                    {(x.status === "live" || x.status === "retired") && (
                      <span className="text-right">
                        <span className="mono block">{s?.units ?? 0} sold</span>
                        <span className="label mt-1 block">{inr(s?.earnedInr ?? 0)} earned</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="recent-h" className="mt-14">
        <div className="flex items-end justify-between gap-4">
          <h2 id="recent-h" className="label text-fg">
            [ Recent sales ]
          </h2>
          <Link href="/designer/earnings" className="label underline underline-offset-4 hover:text-fg">
            Full earnings
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="mt-4 text-muted">Nothing sold yet. Sales show up here once a design is live.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {recent.map((x, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span>
                  {x.productName} <span className="text-muted">· {x.colorway} · {x.size} · ×{x.qty}</span>
                </span>
                <span className="mono text-[0.9rem]">
                  {x.state === "counted" ? `+${inr(x.commissionInr)}` : <span className="text-muted">awaiting payment</span>} <span className="text-muted">· {fmtDate(x.date)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

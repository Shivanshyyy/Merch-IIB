import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DesignerDecision } from "@/components/admin/DesignerDecision";
import { PayoutPanel } from "@/components/admin/PayoutPanel";
import { ResetPassword } from "@/components/admin/ResetPassword";
import { DesignChip, DesignerChip } from "@/components/admin/status";
import { StatTile } from "@/components/admin/StatTile";
import { FreshOnVisit } from "@/components/ui/FreshOnVisit";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { summarizeDesigner } from "@/lib/designer/sales";
import { fmtDay, inr } from "@/lib/format";
import { getSettingsFresh } from "@/lib/settings";

export const metadata: Metadata = { title: "Designer" };

type Props = { params: Promise<{ id: string }> };

export default function DesignerPage({ params }: Props) {
  return (
    <div className="grid gap-6">
      <Link href="/admin/designers" className="admin-label w-fit underline underline-offset-4 hover:text-fg">
        ← Designers
      </Link>
      <Suspense fallback={<div className="skeleton h-96" aria-hidden />}>
        <Designer params={params} />
      </Suspense>
    </div>
  );
}

async function Designer({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  const d = db();
  const [designer, profile] = await Promise.all([d.getDesigner(id).catch(() => null), d.getProfile(id).catch(() => null)]);
  if (!designer || !profile) notFound();
  const [designs, orders, payouts, products, settings] = await Promise.all([d.listDesignsByDesigner(id), d.listOrdersWithDesigner(id), d.listPayouts(id), d.listAllProducts(), getSettingsFresh()]);
  const sum = summarizeDesigner(orders, id, payouts);
  const slugById = new Map(products.map((p) => [p.id, p.slug]));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="t-display text-3xl">{profile.full_name}</h1>
          <p className="admin-label mt-2">
            {profile.email} · <span className="mono">{profile.phone}</span> · applied {fmtDay(designer.created_at)}
          </p>
        </div>
        <DesignerChip status={designer.status} />
      </div>
      {designer.bio && <p className="max-w-2xl text-muted">{designer.bio}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Units sold" value={sum.unitsSold} sub={sum.unitsPending ? `${sum.unitsPending} awaiting payment` : undefined} />
        <StatTile label="Commission earned" value={inr(sum.earnedInr)} />
        <StatTile label="Paid out" value={inr(sum.paidInr)} />
        <StatTile label="Balance owed" value={inr(Math.max(0, sum.balanceInr))} sub={sum.balanceInr < 0 ? `${inr(-sum.balanceInr)} overpaid after refunds` : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="dec-h" className="admin-card p-5">
          <h2 id="dec-h" className="mb-4 text-[1rem] font-semibold">
            Account & commission
          </h2>
          <FreshOnVisit>
            <DesignerDecision key={`${designer.status}-${designer.commission_pct}`} designer={designer} />
          </FreshOnVisit>
        </section>

        <section aria-labelledby="pay-h" className="admin-card p-5">
          <h2 id="pay-h" className="mb-4 text-[1rem] font-semibold">
            Payouts
          </h2>
          <FreshOnVisit>
            <PayoutPanel designerId={id} upiId={designer.upi_id} balance={sum.balanceInr} payouts={payouts} />
          </FreshOnVisit>
        </section>
      </div>

      <section aria-labelledby="designs-h" className="admin-card">
        <h2 id="designs-h" className="px-5 pt-5 text-[1rem] font-semibold">
          Designs ({designs.length})
        </h2>
        {designs.length === 0 ? (
          <p className="admin-label p-5">No designs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table mt-3">
              <thead>
                <tr>
                  <th>Design</th>
                  <th>Status</th>
                  <th className="num">Sold</th>
                  <th className="num">Earned</th>
                </tr>
              </thead>
              <tbody>
                {designs.map((x) => {
                  const p = x.product_id ? sum.byProduct.find((row) => row.slug === slugById.get(x.product_id!)) : undefined;
                  return (
                    <tr key={x.id}>
                      <td>
                        <Link href={`/admin/designs/${x.id}`} className="underline-offset-4 hover:underline">
                          {x.title}
                        </Link>
                      </td>
                      <td>
                        <DesignChip status={x.status} />
                      </td>
                      <td className="num">{p?.units ?? 0}</td>
                      <td className="num mono">{inr(p?.earnedInr ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="pw-h" className="admin-card p-5">
        <h2 id="pw-h" className="text-[1rem] font-semibold">
          Reset password
        </h2>
        <p className="admin-label mb-4 mt-1">Same login as their customer account. There&apos;s no email reset, so set a new password here and send it on WhatsApp.</p>
        <FreshOnVisit>
          <ResetPassword key={profile.id} userId={profile.id} phone={profile.phone} firstName={profile.full_name.split(/\s+/)[0]} brand={settings.brand} />
        </FreshOnVisit>
      </section>
    </>
  );
}

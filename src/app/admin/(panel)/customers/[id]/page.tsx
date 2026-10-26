import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CustomerForm } from "@/components/admin/CustomerForm";
import { FreshOnVisit } from "@/components/ui/FreshOnVisit";
import { ResetPassword } from "@/components/admin/ResetPassword";
import { OrderChip, PaymentChip } from "@/components/admin/status";
import { fmtShort } from "@/lib/admin/dates";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { fmtDay, inr } from "@/lib/format";
import { getSettingsFresh } from "@/lib/settings";

export const metadata: Metadata = { title: "Customer" };

type Props = { params: Promise<{ id: string }> };

export default function CustomerPage({ params }: Props) {
  return (
    <div className="grid gap-6">
      <Link href="/admin/customers" className="admin-label w-fit underline underline-offset-4 hover:text-fg">
        ← Customers
      </Link>
      <Suspense fallback={<div className="skeleton h-96" aria-hidden />}>
        <Customer params={params} />
      </Suspense>
    </div>
  );
}

async function Customer({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  const d = db();
  const profile = await d.getProfile(id).catch(() => null);
  if (!profile) notFound();
  const [orders, settings] = await Promise.all([d.listOrdersByUser(id), getSettingsFresh()]);

  return (
    <>
      <div>
        <h1 className="t-display text-3xl">{profile.full_name}</h1>
        <p className="admin-label mt-2">
          {profile.email} · joined {fmtDay(profile.created_at)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="det-h" className="admin-card p-5">
          <h2 id="det-h" className="mb-4 text-[1rem] font-semibold">
            Details
          </h2>
          <FreshOnVisit>
            <CustomerForm key={profile.id} profile={profile} />
          </FreshOnVisit>
        </section>

        <section aria-labelledby="pw-h" className="admin-card p-5">
          <h2 id="pw-h" className="text-[1rem] font-semibold">
            Reset password
          </h2>
          <p className="admin-label mb-4 mt-1">There&apos;s no email reset. Set a new password here and send it on WhatsApp.</p>
          <FreshOnVisit>
            <ResetPassword key={profile.id} userId={profile.id} phone={profile.phone} firstName={profile.full_name.split(/\s+/)[0]} brand={settings.brand} />
          </FreshOnVisit>
        </section>
      </div>

      <section aria-labelledby="ord-h" className="admin-card">
        <h2 id="ord-h" className="px-5 pt-5 text-[1rem] font-semibold">
          Orders ({orders.length})
        </h2>
        {orders.length === 0 ? (
          <p className="admin-label p-5">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table mt-3">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Placed</th>
                  <th className="num">Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/admin/orders?order=${o.code}`} className="mono underline-offset-4 hover:underline">
                        {o.code}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap text-muted">{fmtShort(o.created_at)}</td>
                    <td className="num mono">{inr(o.total_inr)}</td>
                    <td>
                      <PaymentChip status={o.payment_status} />
                    </td>
                    <td>
                      <OrderChip status={o.order_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

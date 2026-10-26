import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OrderDrawer } from "@/components/admin/OrderDrawer";
import { OrderFilters } from "@/components/admin/OrderFilters";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { requireAdmin } from "@/lib/admin/guard";
import { PAGE_SIZE, parseOrderParams, withParams, type SearchParams } from "@/lib/admin/params";
import { defaultTemplateKey, templatesFor } from "@/lib/admin/whatsapp";
import { db } from "@/lib/db";
import { getSettingsFresh } from "@/lib/settings";

export const metadata: Metadata = { title: "Orders" };

type Props = { searchParams: Promise<SearchParams> };

export default function OrdersPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<div className="skeleton h-96" aria-hidden />}>
      <Orders searchParams={searchParams} />
    </Suspense>
  );
}

async function Orders({ searchParams }: Props) {
  await requireAdmin();
  const { filter, page, order: openCode, values } = parseOrderParams(await searchParams);
  const d = db();
  const [{ rows, total }, batches] = await Promise.all([d.searchOrders(filter), d.listBatches()]);

  const { order: _omit, ...kept } = { ...values, page: page > 1 ? String(page) : "", order: "" };
  void _omit;
  const current = Object.fromEntries(Object.entries(kept).filter(([, v]) => v)) as Record<string, string>;
  const hrefFor = (code: string) => withParams("/admin/orders", current, { order: code });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : filter.offset + 1;
  const to = Math.min(total, filter.offset + PAGE_SIZE);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="t-display text-3xl">Orders</h1>
        <p className="admin-label mt-2">
          {total} {total === 1 ? "order" : "orders"}
        </p>
      </div>

      <OrderFilters key={JSON.stringify(values)} values={values} batches={batches.map((b) => ({ id: b.id, name: b.name }))} />
      <OrdersTable orders={rows} hrefs={Object.fromEntries(rows.map((o) => [o.code, hrefFor(o.code)]))} activeCode={openCode} />

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-4">
          <p className="admin-label">
            {from}–{to} of {total}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link className="btn btn-ghost btn-sm" href={withParams("/admin/orders", current, { page: page - 1 > 1 ? String(page - 1) : undefined })}>
                <span className="btn-fill" aria-hidden />
                <span>← Newer</span>
              </Link>
            )}
            {page < pages && (
              <Link className="btn btn-ghost btn-sm" href={withParams("/admin/orders", current, { page: String(page + 1) })}>
                <span className="btn-fill" aria-hidden />
                <span>Older →</span>
              </Link>
            )}
          </div>
        </nav>
      )}

      {openCode && (
        <Suspense fallback={null}>
          <Drawer code={openCode} closeHref={withParams("/admin/orders", current, {})} />
        </Suspense>
      )}
    </div>
  );
}

// Looked up by code so a link from anywhere (dashboard, customer page) opens the right order, even off the current page.
async function Drawer({ code, closeHref }: { code: string; closeHref: string }) {
  const d = db();
  const order = await d.getOrderByCode(code.toUpperCase());
  if (!order) return null;
  const [events, batch, settings, products] = await Promise.all([d.listEvents(order.id), d.getBatch(order.batch_id), getSettingsFresh(), d.listAllProducts()]);

  return (
    <OrderDrawer
      order={order}
      events={events}
      batchName={batch?.name ?? "Unknown batch"}
      closeHref={closeHref}
      templates={templatesFor(order, settings, batch)}
      defaultTemplate={defaultTemplateKey(order)}
      sizesBySlug={Object.fromEntries(products.map((p) => [p.slug, p.sizes]))}
      customerHref={order.user_id ? `/admin/customers/${order.user_id}` : null}
    />
  );
}

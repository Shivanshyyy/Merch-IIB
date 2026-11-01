import { isOnSale } from "@/lib/discount";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductActions } from "@/components/admin/ProductActions";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { inr } from "@/lib/format";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="skeleton h-96" aria-hidden />}>
      <Products />
    </Suspense>
  );
}

async function Products() {
  await requireAdmin();
  const products = await db().listAllProducts();

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-display text-3xl">Products</h1>
          <p className="admin-label mt-2">Changes go live on the shop straight away.</p>
        </div>
        <Link href="/admin/products/new" className="btn btn-sm">
          <span className="btn-fill" aria-hidden />
          <span>New product</span>
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="admin-card p-10 text-center text-muted">No products yet. Create the first one.</p>
      ) : (
        <ul className="grid gap-3">
          {products.map((p) => (
            <li key={p.id} className="admin-card grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link href={`/admin/products/${p.id}`} className="text-[1.05rem] font-semibold underline-offset-4 hover:underline">
                    {p.name}
                  </Link>
                  <span className={`admin-label rounded-full border px-2.5 py-0.5 ${p.active ? "border-[#0ca30c]/60 text-fg" : "border-line"}`}>{p.active ? "Live" : "Hidden"}</span>
                </div>
                <p className="admin-label mt-1.5">
                  <span className="mono">/shop/{p.slug}</span> · {p.type} · sizes {p.sizes.join(", ")}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                  <span className="mono text-[1.05rem]">{inr(p.price_inr)}</span>
                  {isOnSale(p) && <span className="admin-label line-through">{inr(p.compare_at_inr)}</span>}
                  <ul className="flex flex-wrap items-center gap-3" aria-label="Colourways">
                    {p.colorways.map((c) => (
                      <li key={c.name} className="admin-label flex items-center gap-2">
                        <span aria-hidden className="relative block size-5 overflow-hidden rounded-full border border-line" style={{ background: c.body }}>
                          <span className="absolute inset-x-0.5 top-1/2 h-px -rotate-12" style={{ background: c.stitch }} />
                        </span>
                        {c.name}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/products/${p.id}`} className="btn btn-ghost btn-sm">
                  <span className="btn-fill" aria-hidden />
                  <span>Edit</span>
                </Link>
                <ProductActions id={p.id} active={p.active} name={p.name} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DesignReview } from "@/components/admin/DesignReview";
import { PublishDesign } from "@/components/admin/PublishDesign";
import { RetireDesign } from "@/components/admin/RetireDesign";
import { DesignChip } from "@/components/admin/status";
import { FreshOnVisit } from "@/components/ui/FreshOnVisit";
import { canPublish, uniqueSlug } from "@/lib/admin/designer-flow";
import { fmtShort } from "@/lib/admin/dates";
import { requireAdmin } from "@/lib/admin/guard";
import { db } from "@/lib/db";
import { summarizeDesigner, summarizeProfit } from "@/lib/designer/sales";
import { inr } from "@/lib/format";
import { adminDesignImageUrl } from "@/lib/photos";

export const metadata: Metadata = { title: "Design" };

type Props = { params: Promise<{ id: string }> };

export default function DesignPage({ params }: Props) {
  return (
    <div className="grid gap-6">
      <Link href="/admin/designs" className="admin-label w-fit underline underline-offset-4 hover:text-fg">
        ← Designs
      </Link>
      <Suspense fallback={<div className="skeleton h-96" aria-hidden />}>
        <Design params={params} />
      </Suspense>
    </div>
  );
}

async function Design({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  const d = db();
  const design = /^[0-9a-f-]{36}$/i.test(id) ? await d.getDesign(id) : null;
  if (!design) notFound();
  const [designer, profile, products] = await Promise.all([d.getDesigner(design.designer_id), d.getProfile(design.designer_id), d.listAllProducts()]);
  const product = design.product_id ? (products.find((p) => p.id === design.product_id) ?? null) : null;
  const blocked = design.status === "approved" ? canPublish(design, designer) : null;

  // How this design has sold, for live and retired ones.
  const designerOrders = product && designer ? await d.listOrdersWithDesigner(designer.id) : [];
  const sales = product && designer ? summarizeDesigner(designerOrders, designer.id, []).byProduct.find((row) => row.productId === product.id) : undefined;
  const money = product && designer ? summarizeProfit(designerOrders, designer.id).byProduct.find((row) => row.productId === product.id) : undefined;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="t-display text-3xl">{design.title}</h1>
          <p className="admin-label mt-2">
            by{" "}
            <Link href={`/admin/designers/${design.designer_id}`} className="underline underline-offset-4 hover:text-fg">
              {profile?.full_name ?? "unknown designer"}
            </Link>
            {design.submitted_at ? ` · sent ${fmtShort(design.submitted_at)}` : ""}
          </p>
        </div>
        <DesignChip status={design.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section aria-labelledby="img-h" className="admin-card p-5">
          <h2 id="img-h" className="mb-4 text-[1rem] font-semibold">
            Images ({design.images.length})
          </h2>
          {design.images.length === 0 ? (
            <p className="admin-label">No images.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3">
              {design.images.map((imageId, i) => (
                <li key={imageId}>
                  <a href={adminDesignImageUrl(imageId)} target="_blank" rel="noopener" className="relative block aspect-[4/5] overflow-hidden border border-line bg-bg-2">
                    <Image src={adminDesignImageUrl(imageId)} alt={`Design image ${i + 1}`} fill unoptimized sizes="(min-width: 1024px) 28vw, 45vw" className="object-contain" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid content-start gap-6">
          <section aria-labelledby="det-h" className="admin-card p-5">
            <h2 id="det-h" className="mb-4 text-[1rem] font-semibold">
              Details
            </h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[0.95rem]">
              <dt className="admin-label">Garment</dt>
              <dd>{design.product_type === "hoodie" ? "Hoodie" : "T-shirt"}</dd>
              <dt className="admin-label">Colours</dt>
              <dd>{design.colorways.map((c) => c.name).join(", ") || "None"}</dd>
              <dt className="admin-label">Suggested price</dt>
              <dd className="mono">{design.suggested_price_inr ? inr(design.suggested_price_inr) : "—"}</dd>
              <dt className="admin-label">Own work</dt>
              <dd>{design.originality_confirmed_at ? `Confirmed ${fmtShort(design.originality_confirmed_at)}` : "Not confirmed"}</dd>
              <dt className="admin-label">Description</dt>
              <dd className="whitespace-pre-line">{design.description || "—"}</dd>
              {design.print_file_url && (
                <>
                  <dt className="admin-label">Print file</dt>
                  <dd className="break-all">
                    <a href={design.print_file_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                      {design.print_file_url}
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </section>

          {(design.status === "in_review" || design.status === "approved") && (
            <section aria-labelledby="rev-h" className="admin-card p-5">
              <h2 id="rev-h" className="mb-4 text-[1rem] font-semibold">
                Review
              </h2>
              <FreshOnVisit>
                <DesignReview designId={design.id} status={design.status} note={design.review_note} />
              </FreshOnVisit>
            </section>
          )}
          {design.review_note && design.status !== "in_review" && design.status !== "approved" && (
            <blockquote className="admin-card p-5">
              <p className="admin-label mb-1">Last note to the designer</p>
              <p>{design.review_note}</p>
            </blockquote>
          )}
        </div>
      </div>

      {design.status === "approved" && (
        <section aria-labelledby="pub-h" className="admin-card p-5">
          <h2 id="pub-h" className="mb-1 text-[1rem] font-semibold">
            Put it live
          </h2>
          <p className="admin-label mb-4">Creates the shop product with these images and records what it costs, so the designer&apos;s commission can be worked out.</p>
          {blocked || !designer || designer.commission_pct === null ? (
            <p role="alert" className="border border-[#b3261e] p-3 text-[0.9rem] text-[#b3261e]">
              {blocked ?? "The designer has no commission yet."}
            </p>
          ) : (
            <FreshOnVisit>
              <PublishDesign
                designId={design.id}
                designerRate={designer.commission_pct}
                defaults={{
                  name: design.title,
                  slug: uniqueSlug(design.title, products.map((p) => p.slug)),
                  description: design.description.slice(0, 400),
                  price: design.suggested_price_inr?.toString() ?? "",
                  sizes: "S, M, L, XL, XXL",
                }}
              />
            </FreshOnVisit>
          )}
        </section>
      )}

      {(design.status === "live" || design.status === "retired") && (
        <section aria-labelledby="live-h" className="admin-card p-5">
          <h2 id="live-h" className="mb-3 text-[1rem] font-semibold">
            {design.status === "live" ? "Live in the shop" : "Off sale"}
          </h2>
          <p className="text-[0.95rem]">
            {sales ? `${sales.units} sold so far` : "No sales yet"}
            {sales && sales.pendingUnits > 0 ? `, ${sales.pendingUnits} awaiting payment` : ""}.
          </p>
          {money && (
            <dl className="mt-3 grid max-w-sm gap-1 text-[0.95rem]">
              {([["Profit made", money.profitInr], ["Owed to designer", money.commissionInr], ["You keep", money.keepInr]] as const).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-muted">{label}</dt>
                  <dd className="mono m-0">{inr(value)}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {product && (
              <Link href={`/admin/products/${product.id}`} className="btn btn-quiet btn-sm">
                <span className="btn-fill" aria-hidden />
                <span>Edit product & terms</span>
              </Link>
            )}
            {product && design.status === "live" && (
              <Link href={`/shop/${product.slug}`} target="_blank" className="admin-label underline underline-offset-4 hover:text-fg">
                View in shop ↗
              </Link>
            )}
            {design.status === "live" && <RetireDesign designId={design.id} />}
          </div>
        </section>
      )}
    </>
  );
}

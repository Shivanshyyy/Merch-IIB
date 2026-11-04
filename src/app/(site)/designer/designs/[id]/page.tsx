import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DesignChip } from "@/components/admin/status";
import { DesignActions } from "@/components/designer/DesignActions";
import { DesignForm } from "@/components/designer/DesignForm";
import { DesignImages } from "@/components/designer/DesignImages";
import { requireApprovedDesigner } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { DESIGN_STATUS_HELP, designerCanDelete, designerCanEdit, submitProblems } from "@/lib/designer/design-flow";
import { inr } from "@/lib/format";

export const metadata: Metadata = { title: "Design", robots: { index: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> };

export default function DesignPage(props: Props) {
  return (
    <Suspense fallback={<div className="skeleton h-96 min-h-[calc(100svh-20rem)]" aria-hidden />}>
      <Design {...props} />
    </Suspense>
  );
}

async function Design({ params, searchParams }: Props) {
  const [{ id }, { new: isNew }] = await Promise.all([params, searchParams]);
  const { designer } = await requireApprovedDesigner(`/designer/designs/${id}`);
  const design = /^[0-9a-f-]{36}$/i.test(id) ? await db().getDesign(id) : null;
  if (!design || design.designer_id !== designer.id) notFound();

  const editable = designerCanEdit(design.status);
  const product = design.status === "live" && design.product_id ? await db().getProductById(design.product_id) : null;

  return (
    <>
      <Link href="/designer/designs" className="label hover:text-fg">
        ← All designs
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="t-display t-h1">{design.title}</h1>
        <DesignChip status={design.status} />
      </div>
      <p className="mt-4 max-w-xl text-muted">{DESIGN_STATUS_HELP[design.status]}</p>
      {isNew && design.images.length === 0 && (
        <p role="status" className="mt-6 max-w-xl border border-line p-4 text-[0.95rem]">
          Design created. Now add your images below.
        </p>
      )}
      {design.review_note && (
        <blockquote className="mt-6 max-w-xl border-l-2 border-fg pl-4">
          <p className="label mb-1">Note from the team</p>
          <p>{design.review_note}</p>
        </blockquote>
      )}
      {product && (
        <p className="mt-6">
          <Link href={`/shop/${product.slug}`} className="underline underline-offset-4 hover:text-muted">
            View it in the store →
          </Link>
        </p>
      )}

      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:gap-20">
        <div className="grid content-start gap-10">
          <DesignImages designId={design.id} images={design.images} editable={editable} />
          {editable && <DesignActions designId={design.id} problems={submitProblems(design)} canDelete={designerCanDelete(design.status)} resubmit={design.status === "changes_requested"} />}
        </div>

        <section aria-labelledby="details-h" className="grid content-start gap-6">
          <h2 id="details-h" className="label text-fg">
            [ Details ]
          </h2>
          {editable ? (
            <DesignForm design={design} />
          ) : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 text-[0.95rem]">
              <dt className="label">Garment</dt>
              <dd>{design.product_type === "hoodie" ? "Hoodie" : "T-shirt"}</dd>
              <dt className="label">Colours</dt>
              <dd>{design.colorways.map((c) => c.name).join(", ") || "None"}</dd>
              <dt className="label">Your price</dt>
              <dd className="mono">{design.suggested_price_inr ? inr(design.suggested_price_inr) : "Not set"}</dd>
              <dt className="label">Description</dt>
              <dd className="whitespace-pre-line">{design.description || "None"}</dd>
              {design.print_file_url && (
                <>
                  <dt className="label">Print file</dt>
                  <dd className="break-all">
                    <a href={design.print_file_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                      {design.print_file_url}
                    </a>
                  </dd>
                </>
              )}
            </dl>
          )}
        </section>
      </div>
    </>
  );
}

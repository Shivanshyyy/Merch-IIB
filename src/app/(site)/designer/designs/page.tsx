import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { DesignChip } from "@/components/admin/status";
import { Button } from "@/components/ui/Button";
import { requireApprovedDesigner } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { designImageUrl } from "@/lib/photos";

export const metadata: Metadata = { title: "My designs", robots: { index: false } };

export default function DesignsPage() {
  return (
    <Suspense fallback={<div className="skeleton h-96 min-h-[calc(100svh-20rem)]" aria-hidden />}>
      <Designs />
    </Suspense>
  );
}

async function Designs() {
  const { designer } = await requireApprovedDesigner("/designer/designs");
  const designs = await db().listDesignsByDesigner(designer.id);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">[ My designs ]</p>
          <h1 className="t-display t-h1 mt-4">Your designs</h1>
        </div>
        <Button href="/designer/designs/new">New design</Button>
      </div>

      {designs.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-6 border border-dashed border-line px-6 py-20 text-center">
          <p className="t-display text-2xl">No designs yet</p>
          <p className="mx-auto max-w-sm text-muted">Upload your first design. We review it, and if it goes live you earn commission on every piece sold.</p>
          <Button href="/designer/designs/new" size="lg">
            Upload a design
          </Button>
        </div>
      ) : (
        <ul className="mt-12 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {designs.map((d) => (
            <li key={d.id}>
              <Link href={`/designer/designs/${d.id}`} className="group grid gap-3">
                <div className="relative aspect-[4/5] overflow-hidden border border-line bg-bg-2">
                  {d.images[0] ? (
                    <Image src={designImageUrl(d.images[0])} alt="" fill unoptimized sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
                  ) : (
                    <span className="label absolute inset-0 grid place-items-center">No image yet</span>
                  )}
                </div>
                <div>
                  <p className="font-medium">{d.title}</p>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <DesignChip status={d.status} />
                    <span className="label">Edited {fmtDate(d.updated_at)}</span>
                  </div>
                  {(d.status === "changes_requested" || d.status === "rejected") && d.review_note && <p className="mt-2 line-clamp-2 text-[0.9rem] text-muted">&ldquo;{d.review_note}&rdquo;</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

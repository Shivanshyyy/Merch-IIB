import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { DesignChip } from "@/components/admin/status";
import { fmtShort } from "@/lib/admin/dates";
import { requireAdmin } from "@/lib/admin/guard";
import type { SearchParams } from "@/lib/admin/params";
import { db } from "@/lib/db";
import { DESIGN_STATUS_LABEL } from "@/lib/designer/design-flow";
import { adminDesignImageUrl } from "@/lib/photos";
import type { DesignStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Designs" };

type Props = { searchParams: Promise<SearchParams> };
const STATUSES: DesignStatus[] = ["in_review", "approved", "changes_requested", "live", "rejected", "retired", "draft"];

export default function DesignsPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<div className="skeleton h-96" aria-hidden />}>
      <Designs searchParams={searchParams} />
    </Suspense>
  );
}

async function Designs({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const all = sp.status === "all";
  const status = all ? undefined : (STATUSES.find((s) => s === sp.status) ?? "in_review"); // what needs a look comes first
  const d = db();
  const [designs, designers] = await Promise.all([d.listDesigns(), d.listDesigners()]);
  const nameOf = new Map(designers.map((x) => [x.id, x.full_name]));
  const rows = designs.filter((x) => !status || x.status === status);
  const count = (s: DesignStatus) => designs.filter((x) => x.status === s).length;

  const tab = (label: string, value: string, n: number, active: boolean) => (
    <Link key={value} href={`/admin/designs?status=${value}`} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-2 border-b-2 px-3 text-[0.9rem] ${active ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"}`}>
      {label} <span className="mono text-[0.75rem]">{n}</span>
    </Link>
  );

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="t-display text-3xl">Designs</h1>
        <p className="admin-label mt-2">Review what designers submit, then put approved designs live in the shop.</p>
      </div>

      <nav aria-label="Design status" className="flex overflow-x-auto border-b border-line [scrollbar-width:none]">
        {STATUSES.map((s) => tab(DESIGN_STATUS_LABEL[s], s, count(s), status === s))}
        {tab("All", "all", designs.length, all)}
      </nav>

      {rows.length === 0 ? (
        <p className="admin-card p-10 text-center text-muted">{status === "in_review" ? "Nothing waiting for review." : "No designs here."}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((x) => (
            <li key={x.id}>
              <Link href={`/admin/designs/${x.id}`} className="admin-card grid grid-cols-[88px_1fr] gap-4 p-3">
                <div className="relative aspect-[4/5] overflow-hidden border border-line bg-bg-2">
                  {x.images[0] ? <Image src={adminDesignImageUrl(x.images[0])} alt="" fill unoptimized sizes="88px" className="object-cover" /> : <span className="label absolute inset-0 grid place-items-center">None</span>}
                </div>
                <div className="min-w-0 content-center">
                  <p className="truncate font-medium">{x.title}</p>
                  <p className="admin-label mt-0.5 truncate">{nameOf.get(x.designer_id) ?? "Unknown designer"}</p>
                  <div className="mt-2">
                    <DesignChip status={x.status} />
                  </div>
                  {x.submitted_at && <p className="admin-label mt-1">Sent {fmtShort(x.submitted_at)}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

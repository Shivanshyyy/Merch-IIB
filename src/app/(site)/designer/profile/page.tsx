import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DesignerForm } from "@/components/designer/DesignerForm";
import { FreshOnVisit } from "@/components/ui/FreshOnVisit";
import { requireDesigner } from "@/lib/auth/guards";
import { DESIGNER_STATUS_LABEL } from "@/lib/designer/design-flow";

export const metadata: Metadata = { title: "Designer profile", robots: { index: false } };

export default function DesignerProfilePage() {
  return (
    <Suspense fallback={<div className="skeleton h-96 min-h-[calc(100svh-20rem)]" aria-hidden />}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  const { profile, designer } = await requireDesigner("/designer/profile");
  return (
    <>
      <p className="label">[ Profile ]</p>
      <h1 className="t-display t-h1 mt-4">Your details</h1>

      <dl className="mt-10 grid max-w-xl grid-cols-[auto_1fr] gap-x-5 gap-y-3 sm:gap-x-8 border-y border-line py-6 text-[0.95rem]">
        <dt className="label">Name</dt>
        <dd>{profile.full_name}</dd>
        <dt className="label">Email</dt>
        <dd className="break-all">{profile.email}</dd>
        <dt className="label">Phone</dt>
        <dd className="mono">{profile.phone}</dd>
        <dt className="label">Status</dt>
        <dd>{DESIGNER_STATUS_LABEL[designer.status]}</dd>
        <dt className="label">Commission</dt>
        <dd className="mono">{designer.commission_pct === null ? "Set when you're approved" : `${designer.commission_pct}% of profit`}</dd>
      </dl>
      <p className="mt-4 max-w-xl text-[0.95rem] text-muted">
        To change your name, phone or password, use your <Link href="/account" className="text-fg underline underline-offset-4">account page</Link>.
      </p>

      <section aria-labelledby="details-h" className="mt-12 max-w-xl">
        <h2 id="details-h" className="label mb-6 text-fg">
          [ About you & payouts ]
        </h2>
        <FreshOnVisit>
          <DesignerForm mode="details" defaults={{ bio: designer.bio, upiId: designer.upi_id }} />
        </FreshOnVisit>
      </section>
    </>
  );
}

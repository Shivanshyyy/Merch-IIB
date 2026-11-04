import type { Metadata } from "next";
import { Suspense } from "react";
import { DesignForm } from "@/components/designer/DesignForm";
import { requireApprovedDesigner } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "New design", robots: { index: false } };

export default function NewDesignPage() {
  return (
    <>
      <p className="label">[ New design ]</p>
      <h1 className="t-display t-h1 mt-4">Upload a design</h1>
      <p className="mt-6 max-w-xl text-muted">Start with the details. You&apos;ll add the images on the next screen, then send it to the team.</p>
      <div className="mt-10 max-w-xl">
        <Suspense fallback={<div className="skeleton h-[760px]" aria-hidden />}>
          <Form />
        </Suspense>
      </div>
    </>
  );
}

async function Form() {
  await requireApprovedDesigner("/designer/designs/new");
  return <DesignForm />;
}

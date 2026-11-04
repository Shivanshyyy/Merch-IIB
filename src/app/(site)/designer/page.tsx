import type { Metadata } from "next";
import { Suspense } from "react";
import { StatusPanel } from "@/components/designer/StatusPanel";
import { Button } from "@/components/ui/Button";
import { requireDesigner } from "@/lib/auth/guards";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Designer dashboard", robots: { index: false } };

export default function DesignerDashboardPage() {
  return (
    <Suspense fallback={<div className="skeleton h-96 min-h-[calc(100svh-20rem)]" aria-hidden />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const { profile, designer } = await requireDesigner("/designer");
  const settings = await getSettings();
  if (designer.status !== "approved") return <StatusPanel designer={designer} settings={settings} />;

  return (
    <>
      <p className="label">[ Dashboard ]</p>
      <h1 className="t-display t-h1 mt-4">Hi, {profile.full_name.split(" ")[0]}</h1>
      <p className="mt-6 text-muted">Your commission is {designer.commission_pct}% of profit.</p>
      <div className="mt-8">
        <Button href="/designer/designs/new">Upload a design</Button>
      </div>
    </>
  );
}

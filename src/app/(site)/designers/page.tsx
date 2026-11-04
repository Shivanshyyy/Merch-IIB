import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DesignerForm } from "@/components/designer/DesignerForm";
import { FreshOnVisit } from "@/components/ui/FreshOnVisit";
import { Reveal } from "@/components/ui/Reveal";
import { site } from "@/config/site";
import { authMode } from "@/lib/auth/mode";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Sell your design", description: "Publish your own hoodie or tee design in the store and earn a share of the profit on every piece sold." };

const { min, max } = site.designerCommission;
const STEPS = [
  ["Apply", "Make a designer account. It takes a minute."],
  ["We review you", `The team approves you and sets your commission, between ${min}% and ${max}% of profit.`],
  ["Upload designs", "Add your images and details. We check each design before it goes anywhere."],
  ["Go live & earn", "Once a design is live, your dashboard shows every piece sold and what you've earned."],
] as const;

export default function DesignersPage() {
  return (
    <div className="page">
      <div className="shell grid grid-cols-1 gap-12 lg:grid-cols-[1fr_minmax(0,480px)] lg:gap-24">
        <div>
          <p className="label">[ Designers ]</p>
          <Reveal as="h1" trigger="load" className="t-display t-h1 mt-4">
            {"Sell your\ndesign"}
          </Reveal>
          <p className="mt-8 max-w-md text-muted">
            Design a hoodie or tee, we print and sell it to campus, and you earn {min}–{max}% of the profit on every piece. No upfront cost, no stock to hold.
          </p>
          <ol className="mt-10 grid max-w-md gap-4">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="grid grid-cols-[auto_1fr] gap-x-4 border-t border-line pt-4">
                <span className="mono text-muted">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="mt-1 text-[0.95rem] text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="label mt-8 max-w-md normal-case leading-relaxed tracking-normal">
            Your dashboard shows your own commission, units sold and payouts. It never shows buyers&apos; details. <Link href="/policies#designers" className="underline underline-offset-4 hover:text-fg">Read the designer terms</Link>.
          </p>
        </div>

        <div>
          <Suspense fallback={<div className="skeleton h-[640px] min-h-[calc(100svh-16rem)]" aria-hidden />}>
            <Apply />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function Apply() {
  if (authMode() === "unconfigured") {
    return <p role="alert" className="border border-[#b3261e] p-5 text-[#b3261e]">Accounts aren&apos;t set up yet. Please check back soon.</p>;
  }
  const user = await getSessionUser();

  if (!user) {
    return (
      <FreshOnVisit>
        <h2 className="label mb-6 text-fg">[ Create your designer account ]</h2>
        <DesignerForm mode="signup" />
        <p className="mt-6 text-[0.95rem] text-muted">
          Already have an account here?{" "}
          <Link href="/login?next=%2Fdesigners" className="text-fg underline underline-offset-4">
            Log in to apply
          </Link>
        </p>
      </FreshOnVisit>
    );
  }

  if (await db().getDesigner(user.id)) redirect("/designer");
  const profile = await db().getProfile(user.id);
  if (!profile) {
    return (
      <p className="text-muted">
        Finish your account details first.{" "}
        <Link href="/account?next=%2Fdesigners" className="text-fg underline underline-offset-4">
          Go to account
        </Link>
      </p>
    );
  }
  return (
    <FreshOnVisit>
      <h2 className="label mb-2 text-fg">[ Apply as a designer ]</h2>
      <p className="mb-6 text-muted">
        You&apos;re logged in as <span className="text-fg">{profile.full_name}</span> ({profile.email}). We&apos;ll use these details.
      </p>
      <DesignerForm mode="apply" />
    </FreshOnVisit>
  );
}

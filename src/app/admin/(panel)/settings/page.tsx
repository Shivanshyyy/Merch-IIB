import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { FreshOnVisit } from "@/components/ui/FreshOnVisit";
import { requireAdmin } from "@/lib/admin/guard";
import { getSettingsFresh } from "@/lib/settings";
import { setupChecklist } from "@/lib/settings-schema";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="grid max-w-4xl gap-6">
      <div>
        <h1 className="t-display text-3xl">Settings</h1>
        <p className="admin-label mt-2">Everything customers see about you: payments, contact, pickup and rules. Saved changes are live straight away.</p>
      </div>
      <Suspense fallback={<div className="skeleton h-[600px]" aria-hidden />}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  await requireAdmin();
  const settings = await getSettingsFresh();
  const checklist = setupChecklist(settings);
  const left = checklist.filter((i) => !i.done).length;

  return (
    <>
      <section aria-labelledby="check-h" className="admin-card p-5">
        <h2 id="check-h" className="text-[1rem] font-semibold">
          {left === 0 ? "Setup complete" : `${left} ${left === 1 ? "thing" : "things"} left before launch`}
        </h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {checklist.map((i) => (
            <li key={i.key} className="flex items-start gap-3 text-[0.9rem]">
              <span aria-hidden className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[0.7rem] ${i.done ? "border-[#0ca30c] bg-[#0ca30c] text-bg" : "border-line"}`}>
                {i.done ? "✓" : ""}
              </span>
              <span>
                <span className="font-medium">{i.label}</span>
                <span className="sr-only">{i.done ? " (done)" : " (still a placeholder)"}</span>
                <span className="admin-label block">{i.hint}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <FreshOnVisit>
        <SettingsForm settings={settings} />
      </FreshOnVisit>
      <p className="admin-label">
        The admin password and session secret aren&apos;t editable here: they&apos;re the ADMIN_PASSWORD and ADMIN_SESSION_SECRET environment variables on your host.
      </p>
    </>
  );
}

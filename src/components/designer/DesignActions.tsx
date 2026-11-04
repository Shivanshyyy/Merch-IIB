"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteDesign, submitDesign } from "@/actions/designs";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

// Send to review (with a visible checklist of what's missing) and delete-a-draft.
export function DesignActions({ designId, problems, canDelete, resubmit }: { designId: string; problems: string[]; canDelete: boolean; resubmit: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  const send = () =>
    start(async () => {
      const r = await submitDesign(designId);
      if (r.ok) {
        toast({ message: r.message });
        router.refresh();
      } else setError([r.message, ...(r.problems ?? [])].join(" "));
    });

  const remove = () =>
    start(async () => {
      const r = await deleteDesign(designId);
      toast({ message: r.message });
      if (r.ok) router.push("/designer/designs");
    });

  return (
    <section aria-labelledby="send-h" className="grid gap-4 border-t border-line pt-8">
      <h2 id="send-h" className="label text-fg">
        [ {resubmit ? "Send it back for review" : "Send for review"} ]
      </h2>
      {problems.length > 0 ? (
        <ul className="grid gap-1 text-[0.95rem] text-muted">
          {problems.map((p) => (
            <li key={p} className="flex gap-2">
              <span aria-hidden className="mono">○</span>
              {p}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[0.95rem] text-muted">Everything&apos;s in place. Once you send it you can&apos;t edit it until the team replies.</p>
      )}
      {error && (
        <p role="alert" className="border border-[#b3261e] p-3 text-[0.9rem] text-[#b3261e]">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={send} loading={pending} disabled={problems.length > 0}>
          {resubmit ? "Send back for review" : "Send for review"}
        </Button>
        {canDelete && (
          <ConfirmButton disabled={pending} onConfirm={remove} confirmLabel="Tap again to delete">
            Delete draft
          </ConfirmButton>
        )}
      </div>
    </section>
  );
}

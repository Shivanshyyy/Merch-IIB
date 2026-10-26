"use client";

import { useTransition } from "react";
import { setBatchStatus } from "@/actions/admin/batches";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { BATCH_FLOW } from "@/lib/admin/schemas";
import type { BatchStatus } from "@/lib/types";

const LABEL: Record<BatchStatus, string> = { open: "Open", closed: "Closed", ordered: "Sent to vendor", received: "Received", done: "Done" };

export function BatchStatusButtons({ id, status }: { id: string; status: BatchStatus }) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  return (
    <div role="group" aria-label="Batch status" className="flex flex-wrap gap-2">
      {BATCH_FLOW.map((s) => (
        <Button
          key={s}
          variant={s === status ? "ghost" : "quiet"}
          className={`btn-sm ${s === status ? "btn-current" : ""}`}
          aria-pressed={s === status}
          disabled={pending || s === status}
          onClick={() =>
            start(async () => {
              const r = await setBatchStatus(id, s);
              toast({ message: r.message });
            })
          }
        >
          {s === status ? `✓ ${LABEL[s]}` : LABEL[s]}
        </Button>
      ))}
    </div>
  );
}

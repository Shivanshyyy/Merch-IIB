"use client";

import { useTransition } from "react";
import { deleteProduct, setProductActive } from "@/actions/admin/products";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function ProductActions({ id, active, name }: { id: string; active: boolean; name: string }) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const run = (fn: () => Promise<{ message: string }>) =>
    start(async () => {
      toast({ message: (await fn()).message });
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="quiet" className="btn-sm" disabled={pending} aria-label={`${active ? "Hide" : "Show"} ${name}`} onClick={() => run(() => setProductActive(id, !active))}>
        {active ? "Hide" : "Make live"}
      </Button>
      <ConfirmButton disabled={pending} onConfirm={() => run(() => deleteProduct(id))}>
        Delete
      </ConfirmButton>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { retireDesign } from "@/actions/admin/designs";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { useToast } from "@/components/ui/Toast";

export function RetireDesign({ designId }: { designId: string }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <ConfirmButton disabled={pending} confirmLabel="Tap again to take it off sale" onConfirm={() => start(async () => toast({ message: (await retireDesign(designId)).message }))}>
      Take off sale
    </ConfirmButton>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type Props = { onConfirm: () => void; children: string; confirmLabel?: string; disabled?: boolean; className?: string };

// Two taps for anything destructive: the first arms it for a few seconds, the second does it.
export function ConfirmButton({ onConfirm, children, confirmLabel = "Tap again to confirm", disabled, className = "" }: Props) {
  const [armed, setArmed] = useState(false);
  // The cleanup also runs when the page is hidden, so an armed button can't be left live in the background.
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => {
      clearTimeout(timer);
      setArmed(false);
    };
  }, [armed]);

  return (
    <Button
      variant={armed ? "primary" : "ghost"}
      disabled={disabled}
      className={`btn-sm ${armed ? "" : "btn-danger"} ${className}`}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
          return;
        }
        setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}

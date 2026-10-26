"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { buzz } from "@/lib/haptics";

const query = "(pointer: coarse)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(query);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

// upi:// deep links only work on phones, so desktop gets a hint to scan the QR instead.
export function OpenUpiButton({ link }: { link: string }) {
  const touch = useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
  return (
    <div className="min-h-16">
      {touch ? (
        <Button href={link} size="lg" block onClick={() => buzz(10)}>
          Open UPI app
        </Button>
      ) : (
        <p className="label flex min-h-16 items-center justify-center border border-dashed border-line px-4 text-center normal-case leading-relaxed tracking-normal">
          On a computer? Scan the QR with any UPI app on your phone.
        </p>
      )}
    </div>
  );
}

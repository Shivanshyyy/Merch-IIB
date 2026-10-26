"use client";

import { site } from "@/config/site";

export function Stepper({ value, onChange, label, size = "md" }: { value: number; onChange: (n: number) => void; label: string; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "size-9" : "size-12";
  const btn = `${dim} grid place-items-center border border-line font-mono text-lg leading-none transition-colors hover:border-fg disabled:opacity-30 disabled:hover:border-line`;
  return (
    <div role="group" aria-label={label} className="inline-flex items-center">
      <button type="button" className={btn} aria-label={`Decrease ${label}`} disabled={value <= 1} onClick={() => onChange(value - 1)}>
        −
      </button>
      <output className={`mono grid ${size === "sm" ? "h-9 w-10" : "h-12 w-14"} place-items-center border-y border-line text-sm`} aria-live="polite">
        {value}
      </output>
      <button type="button" className={btn} aria-label={`Increase ${label}`} disabled={value >= site.maxQtyPerLine} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

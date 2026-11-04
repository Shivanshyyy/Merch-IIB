import type { ReactNode } from "react";

// One number with a label and an optional line of context.
export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-3 border border-line p-5">
      <p className="label">{label}</p>
      <p className="mono text-[clamp(1.6rem,4vw,2.2rem)] leading-none tracking-[-0.03em]">{value}</p>
      {sub && <p className="label normal-case tracking-normal">{sub}</p>}
    </div>
  );
}

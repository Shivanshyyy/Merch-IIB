import Link from "next/link";
import type { ReactNode } from "react";

type Props = { label: string; value: ReactNode; sub?: ReactNode; href?: string; hero?: boolean };

// A number is the chart: label, value (proportional figures, same sans as everything else), one line of context.
export function StatTile({ label, value, sub, href, hero = false }: Props) {
  const body = (
    <div className={`admin-card flex h-full flex-col justify-between gap-3 p-5 ${hero ? "sm:p-7" : ""} ${href ? "transition-colors hover:border-[rgba(237,235,230,0.3)]" : ""}`}>
      <p className="admin-label">{label}</p>
      <p className={`font-sans font-semibold leading-none tracking-[-0.02em] ${hero ? "text-[clamp(2.8rem,9vw,4.25rem)]" : "text-[1.9rem]"}`}>{value}</p>
      {sub && <p className="admin-label">{sub}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

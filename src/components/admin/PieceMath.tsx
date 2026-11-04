import { pieceBreakdown, isValidCommission } from "@/lib/designer/commission";
import { inr } from "@/lib/format";

type Props = { price: string; vendor: string; packaging: string; pct: number | null };

// Per-piece money for the admin: what it costs, what is left, what the designer gets and what the store keeps.
export function PieceMath({ price, vendor, packaging, pct }: Props) {
  const p = Number(price);
  const v = Number(vendor);
  const k = packaging.trim() === "" ? 0 : Number(packaging);
  const ready = price.trim() !== "" && vendor.trim() !== "" && [p, v, k].every(Number.isFinite) && v >= 0 && k >= 0 && v + k < p;
  if (!ready) return <p role="status" className="admin-card mb-2 p-4 text-[0.95rem] text-muted">Enter the price and vendor cost to see the profit on each piece.</p>;

  const b = pieceBreakdown(p, v, k, pct !== null && isValidCommission(pct) ? pct : 0);
  const rows: [string, string][] = [
    ["Selling price", inr(p)],
    ["Vendor + packaging", `− ${inr(b.cost)}`],
    ["Profit per piece", inr(b.profit)],
  ];
  if (pct !== null && isValidCommission(pct)) {
    rows.push([`Designer gets (${pct}%)`, inr(b.commission)], ["You keep", inr(b.keep)]);
  }
  return (
    <dl role="status" className="admin-card mb-2 grid gap-1 p-4 text-[0.95rem]">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4">
          <dt className="text-muted">{label}</dt>
          <dd className="mono m-0">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

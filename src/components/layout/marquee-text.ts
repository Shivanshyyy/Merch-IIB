import { formatLeft } from "@/components/home/Countdown";

// The strip's phrases, e.g. ["PREORDER BATCH 01", "CLOSES IN 03D 14H 22M", "PICKUP AT HOSTEL 4"].
export function marqueeParts(o: { batchName: string | null; secondsLeft: number | null; pickup: string; promo?: string | null }): string[] {
  const pickup = o.promo ? `PICKUP AT ${o.pickup.toUpperCase()}  ·  ${o.promo.toUpperCase()}` : `PICKUP AT ${o.pickup.toUpperCase()}`;
  if (!o.batchName) return ["PREORDERS CLOSED", "NEXT BATCH SOON", pickup];
  const name = o.batchName.toUpperCase();
  if (o.secondsLeft !== null && o.secondsLeft <= 0) return [`${name} IS CLOSED`, "NEXT BATCH SOON", pickup];
  return [`PREORDER ${name}`, `CLOSES IN ${formatLeft(o.secondsLeft)}`, pickup];
}

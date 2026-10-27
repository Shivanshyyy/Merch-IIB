"use client";

import Link from "next/link";
import { Stepper } from "@/components/ui/Stepper";
import { ColorwayImage } from "@/components/shop/ColorwayImage";
import { inr } from "@/lib/format";
import { useCart, type CartLine } from "@/store/cart";

export function CartLineRow({ line, compact = false }: { line: CartLine; compact?: boolean }) {
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const closeDrawer = useCart((s) => s.closeDrawer);
  const thumb = compact ? 80 : 120;

  return (
    <li className="flex gap-4 py-5 hair-b">
      <div className="relative shrink-0 bg-bg-2" style={{ width: thumb, height: thumb }}>
        <ColorwayImage slug={line.slug} colorway={line.colorway} body={line.colorwayBody} alt="" sizes={`${thumb}px`} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="t-display truncate text-[0.95rem] tracking-[-0.02em]">{line.productName}</p>
            <p className="label mt-1.5 flex items-center gap-2">
              <span aria-hidden className="inline-block size-2.5 rounded-full border border-line" style={{ background: line.colorwayBody }} />
              {line.colorway} · Size {line.size}
            </p>
            {line.name ? (
              <p className="mono mt-1.5 text-[0.8rem] text-accent-2">
                <span className="text-muted">NAME ›</span> {line.name}
              </p>
            ) : (
              <p className="label mt-1.5 normal-case tracking-normal">No name</p>
            )}
          </div>
          <p className="mono shrink-0 text-[0.95rem]">{inr(line.unitPriceInr * line.qty)}</p>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
          <Stepper size="sm" value={line.qty} onChange={(n) => setQty(line.id, n)} label={`${line.productName} quantity`} />
          <div className="flex gap-4">
            <Link href={`/shop/${line.slug}?edit=${line.id}`} onClick={closeDrawer} className="label underline-offset-4 hover:text-fg hover:underline">
              Edit
            </Link>
            <button type="button" onClick={() => remove(line.id)} className="label underline-offset-4 hover:text-fg hover:underline" aria-label={`Remove ${line.productName}`}>
              Remove
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

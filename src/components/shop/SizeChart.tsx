"use client";

import { useRef } from "react";
import { useSettings } from "@/components/SettingsProvider";

export function SizeChart({ sizes, kind }: { sizes: string[]; kind: "hoodie" | "tee" }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { columns, rows, unit } = useSettings().sizeCharts[kind];

  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className="label underline underline-offset-4 hover:text-fg">
        Size chart
      </button>
      <dialog
        ref={ref}
        aria-label="Size chart"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
        className="m-auto w-[min(92vw,520px)] border border-line bg-bg p-0 text-fg backdrop:bg-black/75 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <p className="label text-fg">[ Size chart ] — {unit}</p>
          <form method="dialog">
            <button className="label flex min-h-11 items-center px-2 hover:text-fg" autoFocus>
              Close ✕
            </button>
          </form>
        </div>
        <table className="mono w-full text-left text-[0.85rem]">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="px-5 py-3 font-normal">Size</th>
              {columns.map((c) => (
                <th key={c} className="px-3 py-3 font-normal">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sizes.map((s) => (
              <tr key={s} className="border-b border-line last:border-0">
                <th className="px-5 py-3 font-medium">{s}</th>
                {(rows[s] ?? columns.map(() => "—")).map((v, i) => (
                  <td key={i} className="px-3 py-3">
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="label border-t border-line px-5 py-4 normal-case tracking-normal">Between sizes? Go up one. Measurements are garment measurements, laid flat.</p>
      </dialog>
    </>
  );
}

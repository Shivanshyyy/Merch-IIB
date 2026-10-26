"use client";

import { useState } from "react";

type Datum = { size: string; count: number };

// Items per size: one series, so one colour, no legend box. Bars are thin, square at the baseline with a rounded tip;
// the value sits at the tip. Hover or focus shows a tooltip; the table twin below carries every number too.
export function SizeBars({ data }: { data: Datum[] }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((n, d) => n + d.count, 0);

  if (!data.length) {
    return <p className="rounded border border-dashed border-line p-6 text-center text-muted">No paid items yet. Verified orders show up here by size.</p>;
  }

  return (
    <figure aria-label="Items per size">
      <div className="grid gap-1 border-l border-line">
        {data.map((d) => {
          const share = Math.round((d.count / total) * 100);
          const on = active === d.size;
          return (
            <div
              key={d.size}
              tabIndex={0}
              role="img"
              aria-label={`Size ${d.size}: ${d.count} items, ${share}% of the total`}
              onPointerEnter={() => setActive(d.size)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(d.size)}
              onBlur={() => setActive(null)}
              className="relative flex min-h-9 items-center gap-3 pr-2 outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent-2"
            >
              <span className="mono w-11 shrink-0 pl-3 text-[0.8rem] text-muted">{d.size}</span>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className="block h-5 rounded-r-[4px] transition-[filter,width] duration-300"
                  style={{ width: `calc(${(d.count / max) * 100}% - 2.5rem)`, minWidth: 4, background: "#3987e5", filter: on ? "brightness(1.25)" : undefined }}
                />
                <span className="mono shrink-0 text-[0.85rem]">{d.count}</span>
              </span>
              {on && (
                <span role="tooltip" className="pointer-events-none absolute right-2 top-full z-10 -mt-1 border border-line bg-bg px-3 py-2 text-[0.8rem] shadow-[0_10px_30px_rgba(0,0,0,.6)]">
                  <strong className="text-[0.95rem]">{d.count} items</strong>
                  <span className="ml-2 text-muted">
                    size {d.size} · {share}%
                  </span>
                </span>
              )}
            </div>
          );
        })}
      </div>

      <details className="mt-5">
        <summary className="admin-label cursor-pointer py-2 hover:text-fg">View as table</summary>
        <table className="admin-table mt-2 max-w-sm">
          <thead>
            <tr>
              <th>Size</th>
              <th className="num">Items</th>
              <th className="num">Share</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.size}>
                <td className="mono">{d.size}</td>
                <td className="num">{d.count}</td>
                <td className="num">{Math.round((d.count / total) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { SizeChart } from "@/config/site";

type ChartRow = { size: string; cells: string[] };

// Unit + column names + one row per size, posted as JSON in a hidden field.
export function SizeChartEditor({ name, initial, error }: { name: string; initial: SizeChart; error?: string }) {
  const [unit, setUnit] = useState(initial.unit);
  const [columns, setColumns] = useState(initial.columns);
  const [rows, setRows] = useState<ChartRow[]>(Object.entries(initial.rows).map(([size, cells]) => ({ size, cells: initial.columns.map((_, i) => cells[i] ?? "") })));
  const chart = { unit, columns, rows: Object.fromEntries(rows.filter((r) => r.size.trim()).map((r) => [r.size.trim().toUpperCase(), r.cells])) };
  const cell = "input !min-h-10 !px-2 !py-1 text-[0.9rem]";

  return (
    <>
      <input type="hidden" name={name} value={JSON.stringify(chart)} />
    <div className="grid gap-4">
      <label className="grid max-w-32 gap-1">
        <span className="admin-label">Unit</span>
        <input className={cell} value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={8} />
      </label>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[26rem] border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="admin-label w-24 text-left font-normal">Size</th>
              {columns.map((c, i) => (
                <th key={i} className="font-normal">
                  <input
                    className={cell}
                    aria-label={`Column ${i + 1} name`}
                    value={c}
                    onChange={(e) => setColumns((cols) => cols.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                </th>
              ))}
              <th className="relative w-10"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                <td>
                  <input className={`${cell} mono`} aria-label={`Row ${ri + 1} size`} value={r.size} onChange={(e) => setRows((rs) => rs.map((x, j) => (j === ri ? { ...x, size: e.target.value } : x)))} maxLength={8} />
                </td>
                {columns.map((_, ci) => (
                  <td key={ci}>
                    <input
                      className={cell}
                      aria-label={`${r.size || `Row ${ri + 1}`} ${columns[ci]}`}
                      value={r.cells[ci] ?? ""}
                      onChange={(e) => setRows((rs) => rs.map((x, j) => (j === ri ? { ...x, cells: x.cells.map((c, k) => (k === ci ? e.target.value : c)) } : x)))}
                      maxLength={12}
                    />
                  </td>
                ))}
                <td>
                  <button type="button" className="admin-label min-h-10 px-1 hover:text-fg" aria-label={`Remove size ${r.size || ri + 1}`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== ri))}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="quiet" className="btn-sm" onClick={() => setRows((rs) => [...rs, { size: "", cells: columns.map(() => "") }])}>
          Add size
        </Button>
        <Button
          variant="quiet"
          className="btn-sm"
          disabled={columns.length >= 6}
          onClick={() => {
            setColumns((c) => [...c, ""]);
            setRows((rs) => rs.map((r) => ({ ...r, cells: [...r.cells, ""] })));
          }}
        >
          Add column
        </Button>
        <Button
          variant="ghost"
          className="btn-sm"
          disabled={columns.length <= 1}
          onClick={() => {
            setColumns((c) => c.slice(0, -1));
            setRows((rs) => rs.map((r) => ({ ...r, cells: r.cells.slice(0, -1) })));
          }}
        >
          Remove last column
        </Button>
      </div>
      {error && (
        <p role="alert" className="field-error">
          The size chart has a blank column name or a value that is too long.
        </p>
      )}
    </div>
    </>
  );
}

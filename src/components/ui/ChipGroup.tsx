"use client";

import { useId, type ReactNode } from "react";

type Option = { value: string; label: ReactNode; swatch?: string };

// Native radios under the hood: arrow keys, focus and form semantics come for free.
export function ChipGroup({ legend, hint, options, value, onChange, error }: { legend: ReactNode; hint?: ReactNode; options: Option[]; value: string | null; onChange: (v: string) => void; error?: string }) {
  const name = useId();
  return (
    <fieldset>
      <legend className="label mb-3 flex w-full items-center justify-between">
        <span>{legend}</span>
        {hint}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className="chip">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.swatch && <span aria-hidden className="size-3.5 rounded-full border border-current/30" style={{ background: o.swatch }} />}
            {o.label}
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

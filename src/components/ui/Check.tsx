"use client";

import { useId, type ComponentProps, type ReactNode } from "react";

export function Check({ label, error, ...input }: Omit<ComponentProps<"input">, "type" | "id"> & { label: ReactNode; error?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="group flex cursor-pointer items-start gap-3 py-1">
        <input id={id} type="checkbox" aria-invalid={error ? true : undefined} className="peer sr-only" {...input} />
        <span
          aria-hidden
          className="mt-0.5 grid size-6 shrink-0 place-items-center border border-line bg-bg-2 text-transparent transition-colors group-hover:border-fg peer-checked:border-accent peer-checked:bg-accent peer-checked:text-bg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-2 peer-aria-invalid:border-accent"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5 9.500 18 20 6" />
          </svg>
        </span>
        <span className="text-[0.95rem] leading-snug">{label}</span>
      </label>
      {/* Reserved height: an error appearing or clearing must not move the checkbox below. */}
      <div className="ml-9 min-h-[1.5rem]">
        {error && (
          <p role="alert" className="field-error m-0 pt-1">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useId, type ComponentProps, type ReactNode } from "react";

type Props = Omit<ComponentProps<"input">, "id"> & { label: ReactNode; error?: string; aside?: ReactNode; help?: ReactNode };

export function TextField({ label, error, aside, help, className = "", ...input }: Props) {
  const id = useId();
  const msg = `${id}-msg`;
  return (
    <div className="field">
      <label htmlFor={id} className="label">
        <span>{label}</span>
        {aside}
      </label>
      <input id={id} className={`input ${className}`} aria-invalid={error ? true : undefined} aria-describedby={error || help ? msg : undefined} {...input} />
      {/* Help and error share one grid cell, so blur-validation never shifts the form (a shift can swallow the next tap). */}
      <div className="mt-2 grid min-h-[1.5rem]">
        {help && (
          <p id={error ? undefined : msg} aria-hidden={error ? true : undefined} className={`label col-start-1 row-start-1 normal-case tracking-normal ${error ? "opacity-0" : ""}`}>
            {help}
          </p>
        )}
        {error && (
          <p id={msg} role="alert" className="field-error col-start-1 row-start-1 m-0">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

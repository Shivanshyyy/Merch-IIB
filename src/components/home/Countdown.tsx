"use client";

import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
};

// Seconds left until `closesAt`, ticking each second. Server snapshot is null so the HTML never mismatches.
export function useSecondsLeft(closesAt: string | undefined): number | null {
  return useSyncExternalStore(
    subscribe,
    () => (closesAt ? Math.max(0, Math.floor((Date.parse(closesAt) - Date.now()) / 1000)) : null),
    () => null,
  );
}

export function formatLeft(s: number | null) {
  if (s === null) return "--D --H --M";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d)}D ${pad(h)}H ${pad(m)}M`;
}

export function Countdown({ closesAt, className = "" }: { closesAt: string | undefined; className?: string }) {
  const left = useSecondsLeft(closesAt);
  return (
    <span className={`mono tabular-nums ${className}`} suppressHydrationWarning>
      {formatLeft(left)}
    </span>
  );
}

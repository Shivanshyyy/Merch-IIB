"use client";

import { useSyncExternalStore } from "react";

// True once the batch cutoff passes, flipping live without a reload. Server snapshot is "open" to match SSR.
export function useBatchClosed(closesAt: string | undefined) {
  return useSyncExternalStore(
    (notify) => {
      if (!closesAt) return () => {};
      const ms = Date.parse(closesAt) - Date.now();
      if (ms <= 0) return () => {};
      const id = setTimeout(notify, Math.min(ms, 2_147_000_000));
      return () => clearTimeout(id);
    },
    () => (closesAt ? Date.now() >= Date.parse(closesAt) : false),
    () => false,
  );
}

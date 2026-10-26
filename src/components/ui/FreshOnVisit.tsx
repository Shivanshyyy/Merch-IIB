"use client";

import { useRouter } from "next/navigation";
import { Fragment, type ReactNode } from "react";

// With Cache Components, pages you leave are kept alive (hidden), form values and action results included.
// Keying on bfcacheId gives a form a clean start on every new visit (so a typed password or a stale "Order placed"
// can't resurface) while browser back/forward still restores what you had.
export function FreshOnVisit({ children }: { children: ReactNode }) {
  const { bfcacheId } = useRouter();
  return <Fragment key={bfcacheId}>{children}</Fragment>;
}

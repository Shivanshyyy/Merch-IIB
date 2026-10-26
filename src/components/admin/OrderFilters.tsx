"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { REFUND_LABEL, STATUS_LABEL } from "@/lib/admin/order-flow";

type Props = { values: { q: string; payment: string; status: string; refund: string; batch: string; sort: string }; batches: { id: string; name: string }[] };

// A plain GET form, so every filtered view is a shareable link. Selects submit as soon as they change.
export function OrderFilters({ values, batches }: Props) {
  const form = useRef<HTMLFormElement>(null);
  const submit = () => form.current?.requestSubmit();
  const sel = "input !min-h-11 !py-1";
  const active = Object.entries(values).some(([k, v]) => v && !(k === "sort" && v === "new"));
  const count = ["payment", "status", "refund", "batch"].filter((k) => values[k as keyof typeof values]).length + (values.sort === "old" ? 1 : 0);
  const [open, setOpen] = useState(count > 0); // phones: filters tuck away until asked for

  return (
    <form ref={form} method="get" action="/admin/orders" role="search" aria-label="Filter orders" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))]">
      <label className="sm:col-span-2 lg:col-span-1">
        <span className="sr-only">Search</span>
        <input type="search" name="q" defaultValue={values.q} placeholder="Search code, email, name or phone" className={sel} enterKeyHint="search" />
      </label>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="order-filters" className="admin-label flex min-h-11 items-center justify-between border border-line px-3 sm:hidden">
        <span>Filters{count ? ` (${count})` : ""}</span>
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      <div id="order-filters" className={`${open ? "grid" : "hidden"} gap-3 sm:contents`}>
      <label>
        <span className="sr-only">Payment</span>
        <select name="payment" defaultValue={values.payment} onChange={submit} className={sel}>
          <option value="">Any payment</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>
      </label>
      <label>
        <span className="sr-only">Order status</span>
        <select name="status" defaultValue={values.status} onChange={submit} className={sel}>
          <option value="">Any status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">Refund</span>
        <select name="refund" defaultValue={values.refund} onChange={submit} className={sel}>
          <option value="">Any refund</option>
          <option value="open">Open refunds</option>
          {(["requested", "approved", "refunded"] as const).map((k) => (
            <option key={k} value={k}>
              {REFUND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">Batch</span>
        <select name="batch" defaultValue={values.batch} onChange={submit} className={sel}>
          <option value="">All batches</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">Sort</span>
        <select name="sort" defaultValue={values.sort} onChange={submit} className={sel}>
          <option value="new">Newest first</option>
          <option value="old">Oldest first</option>
        </select>
      </label>
      </div>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
        <button type="submit" className="btn btn-quiet btn-sm">
          <span className="btn-fill" aria-hidden />
          <span>Search</span>
        </button>
        {active && (
          <Link href="/admin/orders" className="admin-label flex min-h-10 items-center px-3 underline underline-offset-4 hover:text-fg">
            Clear filters
          </Link>
        )}
      </div>
    </form>
  );
}

import type { Order } from "@/lib/types";
import { isLive, sizeCompare } from "./stats";

// The only columns the vendor ever sees. No phone, email, payment or customer data, by design.
export type VendorRow = { product: string; colour: string; size: string; name: string; quantity: number; orderCode: string };

export const VENDOR_COLUMNS = ["product", "colour", "size", "name", "quantity", "order_code"] as const;

export function vendorRows(orders: Order[]): VendorRow[] {
  return orders
    .filter(isLive)
    .sort((a, b) => a.code.localeCompare(b.code))
    .flatMap((o) => o.items.map((i) => ({ product: i.productName, colour: i.colorway, size: i.size, name: i.name, quantity: i.qty, orderCode: o.code })));
}

// Spreadsheet apps run cells starting with = + - @ as formulas; a leading ' makes them plain text.
const safeCell = (v: string | number) => {
  const s = String(v);
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replaceAll('"', '""')}"` : guarded;
};

export function toCsv(rows: VendorRow[]): string {
  const lines = [VENDOR_COLUMNS.join(","), ...rows.map((r) => [r.product, r.colour, r.size, r.name, r.quantity, r.orderCode].map(safeCell).join(","))];
  return "﻿" + lines.join("\r\n") + "\r\n"; // BOM so Excel reads it as UTF-8
}

export type Pivot = { sizes: string[]; rows: { product: string; colour: string; counts: Record<string, number>; total: number }[]; totals: Record<string, number>; grandTotal: number };

// Units by product × colour × size.
export function pivot(rows: VendorRow[]): Pivot {
  const sizes = [...new Set(rows.map((r) => r.size))].sort(sizeCompare);
  const map = new Map<string, Pivot["rows"][number]>();
  const totals: Record<string, number> = Object.fromEntries(sizes.map((s) => [s, 0]));
  let grandTotal = 0;

  for (const r of rows) {
    const key = `${r.product}\u0000${r.colour}`;
    const row = map.get(key) ?? { product: r.product, colour: r.colour, counts: {}, total: 0 };
    row.counts[r.size] = (row.counts[r.size] ?? 0) + r.quantity;
    row.total += r.quantity;
    totals[r.size] += r.quantity;
    grandTotal += r.quantity;
    map.set(key, row);
  }
  const out = [...map.values()].sort((a, b) => a.product.localeCompare(b.product) || a.colour.localeCompare(b.colour));
  return { sizes, rows: out, totals, grandTotal };
}

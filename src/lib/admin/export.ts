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

// ---- Filtering the vendor sheet by garment ----
// A line knows which product it is and what kind of garment that is, so the sheet and its CSV can be cut per garment.
export type VendorLine = VendorRow & { slug: string; kind: string };
export type VendorFilter = { kind?: string; slug?: string };

export const KIND_LABEL: Record<string, string> = { hoodie: "Hoodies", tee: "Tees", other: "Other" };
export const kindLabel = (kind: string) => KIND_LABEL[kind] ?? kind;

// `kinds` maps product slug to its type. A product that has since been deleted lands in "other" instead of vanishing.
export function vendorLines(orders: Order[], kinds: Record<string, string>): VendorLine[] {
  return orders
    .filter(isLive)
    .sort((a, b) => a.code.localeCompare(b.code))
    .flatMap((o) => o.items.map((i) => ({ product: i.productName, colour: i.colorway, size: i.size, name: i.name, quantity: i.qty, orderCode: o.code, slug: i.slug, kind: kinds[i.slug] ?? "other" })));
}

export const toRow = ({ product, colour, size, name, quantity, orderCode }: VendorLine): VendorRow => ({ product, colour, size, name, quantity, orderCode });

export function filterLines(lines: VendorLine[], f: VendorFilter): VendorLine[] {
  return lines.filter((l) => (!f.kind || l.kind === f.kind) && (!f.slug || l.slug === f.slug));
}

export type VendorFacets = { kinds: { kind: string; label: string; units: number }[]; products: { slug: string; name: string; units: number }[] };

// Chips for the filter bar: each garment kind with its units, and the products of the chosen kind (all kinds when none is chosen).
export function facets(lines: VendorLine[], kind?: string): VendorFacets {
  const kinds = new Map<string, number>();
  const products = new Map<string, { slug: string; name: string; units: number }>();
  for (const l of lines) {
    kinds.set(l.kind, (kinds.get(l.kind) ?? 0) + l.quantity);
    if (kind && l.kind !== kind) continue;
    const p = products.get(l.slug) ?? { slug: l.slug, name: l.product, units: 0 };
    p.units += l.quantity;
    products.set(l.slug, p);
  }
  const order = Object.keys(KIND_LABEL);
  return {
    kinds: [...kinds].map(([k, units]) => ({ kind: k, label: kindLabel(k), units })).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.label.localeCompare(b.label)),
    products: [...products.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// Reads ?type= and ?product= and drops anything that doesn't exist in this batch, so a stale link never shows an empty sheet.
export function parseVendorFilter(lines: VendorLine[], type: string | undefined, product: string | undefined): VendorFilter {
  const kind = type && lines.some((l) => l.kind === type) ? type : undefined;
  const slug = product && lines.some((l) => l.slug === product && (!kind || l.kind === kind)) ? product : undefined;
  return { kind, slug };
}

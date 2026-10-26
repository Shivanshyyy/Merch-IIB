import type { OrderFilter, OrderStatus, PaymentStatus, RefundStatus } from "@/lib/types";

export const PAGE_SIZE = 25;

export type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const pick = <T extends string>(v: string | undefined, allowed: readonly T[]): T | undefined => (v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined);

export const PAYMENTS = ["pending", "verified", "rejected"] as const satisfies readonly PaymentStatus[];
export const STATUSES = ["placed", "in_production", "ready", "collected", "cancelled"] as const satisfies readonly OrderStatus[];
export const REFUNDS = ["open", "requested", "approved", "refunded"] as const satisfies readonly (RefundStatus | "open")[];

export function parseOrderParams(sp: SearchParams) {
  const q = one(sp.q)?.trim().slice(0, 60) || undefined;
  const payment = pick(one(sp.payment), PAYMENTS);
  const status = pick(one(sp.status), STATUSES);
  const refund = pick(one(sp.refund), REFUNDS);
  const batch = one(sp.batch) || undefined;
  const sort = pick(one(sp.sort), ["new", "old"] as const) ?? "new";
  const page = Math.max(1, Number.parseInt(one(sp.page) ?? "1", 10) || 1);
  const order = one(sp.order) || undefined;
  const filter: OrderFilter = { q, payment, status, refund, batchId: batch, sort, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE };
  return { filter, page, order, values: { q: q ?? "", payment: payment ?? "", status: status ?? "", refund: refund ?? "", batch: batch ?? "", sort } };
}

// Builds a link that keeps the current filters and changes only the given keys ("" or undefined removes one).
export function withParams(base: string, current: Record<string, string>, change: Record<string, string | undefined>) {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...change })) if (v) next.set(k, v);
  const s = next.toString();
  return s ? `${base}?${s}` : base;
}

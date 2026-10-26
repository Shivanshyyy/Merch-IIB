import "server-only";
import seed from "../../../supabase/seed.json";
import type { Batch, NewOrder, Order, Product } from "@/lib/types";
import { CodeTakenError, type Db } from "./types";

type Store = { products: Product[]; batch: Batch; orders: Order[]; events: { order_id: string; type: string; note: string | null }[] };

// Demo store for local development without Supabase. Lives on globalThis so dev HMR doesn't wipe it.
const g = globalThis as unknown as { __merchMemoryStore?: Store };

function init(): Store {
  const day = 24 * 60 * 60 * 1000;
  return {
    products: seed.products.map((p, i) => ({
      id: `00000000-0000-4000-8000-00000000000${i + 1}`,
      slug: p.slug,
      name: p.name,
      type: p.type as Product["type"],
      description: p.description,
      price_inr: p.price_inr,
      colorways: p.colorways,
      sizes: p.sizes,
      personalizable: true,
      active: true,
      sort: p.sort,
    })),
    batch: {
      id: "00000000-0000-4000-8000-0000000000b1",
      name: seed.batch.name,
      opens_at: new Date(Date.now() - day).toISOString(),
      closes_at: new Date(Date.now() + seed.batch.closesInDays * day).toISOString(),
      est_delivery: seed.batch.estDelivery,
      status: "open",
    },
    orders: [],
    events: [],
  };
}

export function createMemoryDb(): Db {
  const s = (g.__merchMemoryStore ??= init());

  return {
    async listActiveProducts() {
      return s.products.filter((p) => p.active).sort((a, b) => a.sort - b.sort);
    },
    async getProductBySlug(slug) {
      return s.products.find((p) => p.slug === slug && p.active) ?? null;
    },
    async getOpenBatch() {
      return s.batch.status === "open" ? s.batch : null;
    },
    async countPendingOrders(email) {
      return s.orders.filter((o) => o.email === email && o.payment_status === "pending" && o.order_status !== "cancelled").length;
    },
    async insertOrder(order: NewOrder) {
      if (s.orders.some((o) => o.code === order.code)) throw new CodeTakenError();
      const row: Order = {
        ...order,
        id: crypto.randomUUID(),
        utr: null,
        payment_status: "pending",
        order_status: "placed",
        refund_status: "none",
        admin_note: null,
        verified_at: null,
        created_at: new Date().toISOString(),
      };
      s.orders.push(row);
      return row;
    },
    async getOrderByCode(code) {
      return s.orders.find((o) => o.code === code) ?? null;
    },
    async listOrdersByEmail(email) {
      return s.orders.filter((o) => o.email === email).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async setUtr(code, utr) {
      const o = s.orders.find((x) => x.code === code && x.payment_status === "pending");
      if (!o) return false;
      o.utr = utr;
      return true;
    },
    async addEvent(orderId, type, note) {
      s.events.push({ order_id: orderId, type, note: note ?? null });
    },
  };
}

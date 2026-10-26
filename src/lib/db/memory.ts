import "server-only";
import seed from "../../../supabase/seed.json";
import type { Settings } from "@/config/site";
import type { Batch, NewOrder, Order, OrderEvent, Product, Profile } from "@/lib/types";
import { CodeTakenError, EmailTakenError, NotFoundError, SlugTakenError, type Db } from "./types";

export type Store = {
  products: Product[];
  batches: Batch[];
  orders: Order[];
  events: OrderEvent[];
  profiles: Profile[];
  settings: Settings | null;
  eventSeq: number;
};

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
    batches: [
      {
        id: "00000000-0000-4000-8000-0000000000b1",
        name: seed.batch.name,
        opens_at: new Date(Date.now() - day).toISOString(),
        closes_at: new Date(Date.now() + seed.batch.closesInDays * day).toISOString(),
        est_delivery: seed.batch.estDelivery,
        status: "open",
      },
    ],
    orders: [],
    events: [],
    profiles: [],
    settings: null,
    eventSeq: 0,
  };
}

export const memoryStore = (): Store => (g.__merchMemoryStore ??= init());

export function createMemoryDb(): Db {
  const s = memoryStore();

  return {
    async listActiveProducts() {
      return s.products.filter((p) => p.active).sort((a, b) => a.sort - b.sort);
    },
    async getProductBySlug(slug) {
      return s.products.find((p) => p.slug === slug && p.active) ?? null;
    },
    async getOpenBatch() {
      return [...s.batches].filter((b) => b.status === "open").sort((a, b) => b.opens_at.localeCompare(a.opens_at))[0] ?? null;
    },

    async getSettings() {
      return s.settings;
    },
    async saveSettings(value) {
      s.settings = value;
    },

    async getProfile(userId) {
      return s.profiles.find((p) => p.id === userId) ?? null;
    },
    async createProfile(userId, email, data) {
      if (s.profiles.some((p) => p.email === email)) throw new EmailTakenError();
      const row: Profile = { id: userId, email, ...data, created_at: new Date().toISOString() };
      s.profiles.push(row);
      return row;
    },
    async updateProfile(userId, data) {
      const row = s.profiles.find((p) => p.id === userId);
      if (!row) throw new Error("profile not found");
      Object.assign(row, data);
      return row;
    },

    async countPendingOrders(userId) {
      return s.orders.filter((o) => o.user_id === userId && o.payment_status === "pending" && o.order_status !== "cancelled").length;
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
    async listOrdersByUser(userId) {
      return s.orders.filter((o) => o.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async setUtr(code, utr) {
      const o = s.orders.find((x) => x.code === code && x.payment_status === "pending");
      if (!o) return false;
      o.utr = utr;
      return true;
    },
    async addEvent(orderId, type, note) {
      s.events.push({ id: ++s.eventSeq, order_id: orderId, type, note: note ?? null, created_at: new Date().toISOString() });
    },

    // ---- admin ----
    async listAllProducts() {
      return [...s.products].sort((a, b) => a.sort - b.sort);
    },
    async getProductById(id) {
      return s.products.find((p) => p.id === id) ?? null;
    },
    async createProduct(input) {
      if (s.products.some((p) => p.slug === input.slug)) throw new SlugTakenError();
      const row: Product = { ...input, id: crypto.randomUUID() };
      s.products.push(row);
      return row;
    },
    async updateProduct(id, input) {
      const row = s.products.find((p) => p.id === id);
      if (!row) throw new NotFoundError("product");
      if (s.products.some((p) => p.slug === input.slug && p.id !== id)) throw new SlugTakenError();
      Object.assign(row, input);
      return row;
    },
    async deleteProduct(id) {
      s.products = s.products.filter((p) => p.id !== id);
    },

    async listBatches() {
      return [...s.batches].sort((a, b) => b.opens_at.localeCompare(a.opens_at));
    },
    async getBatch(id) {
      return s.batches.find((b) => b.id === id) ?? null;
    },
    async createBatch(input) {
      const row: Batch = { ...input, id: crypto.randomUUID() };
      s.batches.push(row);
      return row;
    },
    async updateBatch(id, patch) {
      const row = s.batches.find((b) => b.id === id);
      if (!row) throw new NotFoundError("batch");
      Object.assign(row, patch);
      return row;
    },

    async searchOrders(f) {
      const term = f.q?.trim().toLowerCase();
      let rows = s.orders.filter((o) => {
        if (f.payment && o.payment_status !== f.payment) return false;
        if (f.status && o.order_status !== f.status) return false;
        if (f.refund === "open" ? !["requested", "approved"].includes(o.refund_status) : f.refund && o.refund_status !== f.refund) return false;
        if (f.batchId && o.batch_id !== f.batchId) return false;
        if (term && ![o.code, o.email, o.full_name, o.phone].some((v) => v.toLowerCase().includes(term))) return false;
        return true;
      });
      rows = rows.sort((a, b) => (f.sort === "old" ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at)));
      return { rows: rows.slice(f.offset, f.offset + f.limit), total: rows.length };
    },
    async listOrdersForBatch(batchId) {
      return s.orders.filter((o) => !batchId || o.batch_id === batchId).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async getOrderById(id) {
      return s.orders.find((o) => o.id === id) ?? null;
    },
    async patchOrder(id, patch, event) {
      const o = s.orders.find((x) => x.id === id);
      if (!o) throw new NotFoundError("order");
      Object.assign(o, patch);
      s.events.push({ id: ++s.eventSeq, order_id: id, type: event.type, note: event.note ?? null, created_at: new Date().toISOString() });
      return { ...o };
    },
    async listEvents(orderId) {
      return s.events.filter((e) => e.order_id === orderId).sort((a, b) => b.id - a.id);
    },

    async listProfiles(query, limit = 100) {
      const term = query?.trim().toLowerCase();
      return s.profiles
        .filter((p) => !term || [p.full_name, p.email, p.roll_no ?? "", p.phone].some((v) => v.toLowerCase().includes(term)))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit);
    },
  };
}

import "server-only";
import seed from "../../../supabase/seed.json";
import type { Settings } from "@/config/site";
import type { Batch, Design, Designer, NewOrder, Order, OrderEvent, Payout, PhotoBlob, Product, ProductTerms, Profile } from "@/lib/types";
import { CodeTakenError, EmailTakenError, NotFoundError, SlugTakenError, type Db } from "./types";

export type Store = {
  products: Product[];
  photoData: Record<string, PhotoBlob>; // by photo id; each product lists its own ids in `photos`
  batches: Batch[];
  orders: Order[];
  events: OrderEvent[];
  profiles: Profile[];
  designers: Designer[];
  designs: Design[];
  designImageData: Record<string, PhotoBlob>; // by image id; each design lists its own ids in `images`
  productTerms: ProductTerms[];
  payouts: Payout[];
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
      compare_at_inr: p.compare_at_inr ?? null,
      name_fee_inr: p.name_fee_inr ?? 0,
      colorways: p.colorways,
      sizes: p.sizes,
      personalizable: (p as { personalizable?: boolean }).personalizable ?? true,
      active: true,
      sort: p.sort,
      photos: [],
    })),
    photoData: {},
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
    designers: [],
    designs: [],
    designImageData: {},
    productTerms: [],
    payouts: [],
    settings: null,
    eventSeq: 0,
  };
}

export const memoryStore = (): Store => {
  const store = (g.__merchMemoryStore ??= init());
  // A store left over from before photos existed (dev HMR keeps globalThis alive) gets the new fields.
  store.photoData ??= {};
  store.designers ??= [];
  store.designs ??= [];
  store.designImageData ??= {};
  store.productTerms ??= [];
  store.payouts ??= [];
  for (const p of store.products) {
    p.photos ??= [];
    p.compare_at_inr ??= null;
    p.name_fee_inr ??= 0;
  }
  for (const o of store.orders) {
    o.freebie ??= false;
    o.discount_inr ??= 0;
    o.discount_label ??= null;
  }
  return store;
};

export function createMemoryDb(): Db {
  const s = memoryStore();

  return {
    async listActiveProducts() {
      return s.products.filter((p) => p.active).sort((a, b) => a.sort - b.sort);
    },
    async getProductBySlug(slug) {
      return s.products.find((p) => p.slug === slug && p.active) ?? null;
    },
    async getPhoto(id) {
      return s.photoData[id] ?? null;
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
        freebie: false,
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

    async countFreebies() {
      return s.orders.filter((o) => o.freebie).length;
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
      const row: Product = { ...input, id: crypto.randomUUID(), photos: [] };
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
      for (const photoId of s.products.find((p) => p.id === id)?.photos ?? []) delete s.photoData[photoId];
      s.products = s.products.filter((p) => p.id !== id);
      s.productTerms = s.productTerms.filter((t) => t.product_id !== id);
      // A design whose product is gone is no longer live.
      for (const d of s.designs.filter((x) => x.product_id === id)) {
        d.product_id = null;
        if (d.status === "live") d.status = "retired";
      }
    },
    async addProductPhoto(productId, photo) {
      const row = s.products.find((p) => p.id === productId);
      if (!row) throw new NotFoundError("product");
      const id = crypto.randomUUID();
      s.photoData[id] = photo;
      row.photos = [...row.photos, id];
      return id;
    },
    async removeProductPhoto(productId, photoId) {
      const row = s.products.find((p) => p.id === productId);
      if (!row) throw new NotFoundError("product");
      row.photos = row.photos.filter((id) => id !== photoId);
      delete s.photoData[photoId];
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

    // ---- designers ----
    async getDesigner(userId) {
      return s.designers.find((d) => d.id === userId) ?? null;
    },
    async createDesigner(userId, input) {
      if (!s.profiles.some((p) => p.id === userId)) throw new NotFoundError("profile");
      if (s.designers.some((d) => d.id === userId)) throw new Error("designer already exists");
      const row: Designer = { id: userId, ...input, status: "pending", commission_pct: null, decision_note: null, decided_at: null, created_at: new Date().toISOString() };
      s.designers.push(row);
      return row;
    },
    async updateDesigner(userId, input) {
      const row = s.designers.find((d) => d.id === userId);
      if (!row) throw new NotFoundError("designer");
      Object.assign(row, input);
      return row;
    },
    async decideDesigner(userId, decision) {
      const row = s.designers.find((d) => d.id === userId);
      if (!row) throw new NotFoundError("designer");
      if (decision.status === "approved" && decision.commission_pct === null) throw new Error("an approved designer needs a commission");
      Object.assign(row, decision, { decided_at: new Date().toISOString() });
      return row;
    },
    async listDesigners(status) {
      return s.designers
        .filter((d) => !status || d.status === status)
        .flatMap((d) => {
          const p = s.profiles.find((x) => x.id === d.id);
          return p ? [{ ...d, full_name: p.full_name, email: p.email, phone: p.phone }] : [];
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async createDesign(designerId, input) {
      if (!s.designers.some((d) => d.id === designerId)) throw new NotFoundError("designer");
      const now = new Date().toISOString();
      const row: Design = {
        ...input,
        id: crypto.randomUUID(),
        designer_id: designerId,
        originality_confirmed_at: null,
        status: "draft",
        review_note: null,
        submitted_at: null,
        reviewed_at: null,
        product_id: null,
        images: [],
        created_at: now,
        updated_at: now,
      };
      s.designs.push(row);
      return row;
    },
    async getDesign(id) {
      return s.designs.find((d) => d.id === id) ?? null;
    },
    async listDesignsByDesigner(designerId) {
      return s.designs.filter((d) => d.designer_id === designerId).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async listDesigns(status) {
      return s.designs.filter((d) => !status || d.status === status).sort((a, b) => (b.submitted_at ?? b.created_at).localeCompare(a.submitted_at ?? a.created_at));
    },
    async patchDesign(id, patch) {
      const row = s.designs.find((d) => d.id === id);
      if (!row) throw new NotFoundError("design");
      Object.assign(row, patch, { updated_at: new Date().toISOString() });
      return row;
    },
    async deleteDesign(id) {
      for (const imageId of s.designs.find((d) => d.id === id)?.images ?? []) delete s.designImageData[imageId];
      s.designs = s.designs.filter((d) => d.id !== id);
      for (const t of s.productTerms.filter((x) => x.design_id === id)) t.design_id = null;
    },
    async addDesignImage(designId, image) {
      const row = s.designs.find((d) => d.id === designId);
      if (!row) throw new NotFoundError("design");
      const id = crypto.randomUUID();
      s.designImageData[id] = image;
      row.images = [...row.images, id];
      row.updated_at = new Date().toISOString();
      return id;
    },
    async removeDesignImage(designId, imageId) {
      const row = s.designs.find((d) => d.id === designId);
      if (!row) throw new NotFoundError("design");
      if (!row.images.includes(imageId)) return;
      row.images = row.images.filter((id) => id !== imageId);
      row.updated_at = new Date().toISOString();
      delete s.designImageData[imageId];
    },
    async getDesignImage(id) {
      const blob = s.designImageData[id];
      const owner = s.designs.find((d) => d.images.includes(id));
      return blob && owner ? { ...blob, designId: owner.id } : null;
    },

    async listProductTerms() {
      return [...s.productTerms];
    },
    async getProductTerms(productId) {
      return s.productTerms.find((t) => t.product_id === productId) ?? null;
    },
    async saveProductTerms(terms) {
      if (!s.products.some((p) => p.id === terms.product_id)) throw new NotFoundError("product");
      const i = s.productTerms.findIndex((t) => t.product_id === terms.product_id);
      if (i === -1) s.productTerms.push({ ...terms });
      else s.productTerms[i] = { ...terms };
    },

    async listOrdersWithDesigner(designerId) {
      return s.orders.filter((o) => o.items.some((i) => i.designer?.id === designerId)).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async listPayouts(designerId) {
      return s.payouts.filter((p) => !designerId || p.designer_id === designerId).sort((a, b) => b.paid_at.localeCompare(a.paid_at));
    },
    async createPayout(input) {
      if (!s.designers.some((d) => d.id === input.designer_id)) throw new NotFoundError("designer");
      const row: Payout = { id: crypto.randomUUID(), ...input, paid_at: new Date().toISOString() };
      s.payouts.push(row);
      return row;
    },
    async deletePayout(id) {
      s.payouts = s.payouts.filter((p) => p.id !== id);
    },
  };
}

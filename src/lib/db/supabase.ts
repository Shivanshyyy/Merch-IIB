import "server-only";
import type { Batch, Design, Designer, DesignerWithProfile, Order, OrderEvent, Payout, PhotoBlob, Product, ProductTerms, Profile } from "@/lib/types";
import { CodeTakenError, EmailTakenError, NotFoundError, SlugTakenError, type Db } from "./types";
import type { ServiceClient } from "./supabase-client";

// Search text goes into a PostgREST filter string: keep it to characters that can't change the filter's meaning.
const cleanSearch = (q: string) => q.replace(/[^\p{L}\p{N}@.+_\- ]/gu, "").trim().slice(0, 60);

export function createSupabaseDb(sb: ServiceClient): Db {
  const fail = (what: string, error: { message: string }): never => {
    throw new Error(`supabase ${what}: ${error.message}`);
  };

  // The designer tables come from migration 0006. Until it has been run, reading them means "no designers yet" rather than
  // taking down every page that checks (the nav, the admin badges, checkout). Writes still fail loudly, as does any other error.
  let warned = false;
  const tableMissing = (error: { code?: string; message: string }): boolean => {
    const gone = error.code === "42P01" || error.code === "PGRST205" || /could not find the table|relation .* does not exist/i.test(error.message);
    if (gone && !warned) {
      warned = true;
      console.error("[db] a designer table is missing: run supabase/migrations/0006_designers.sql");
    }
    return gone;
  };

  // Rows saved before migration 0008 have no breakdown: all of the cost counts as vendor cost.
  const toTerms = (r: { product_id: string; designer_id: string | null; design_id: string | null; cost_inr: number; commission_pct: number | null; vendor_cost_inr?: number | null; packaging_cost_inr?: number | null }): ProductTerms => ({
    product_id: r.product_id,
    designer_id: r.designer_id,
    design_id: r.design_id,
    cost_inr: r.cost_inr,
    commission_pct: r.commission_pct,
    vendor_cost_inr: r.vendor_cost_inr ?? r.cost_inr,
    packaging_cost_inr: r.packaging_cost_inr ?? 0,
  });

  // The photo ids of each product, oldest first. One extra query for the whole list; the image bytes are never selected here.
  const withPhotos = async (rows: Omit<Product, "photos">[]): Promise<Product[]> => {
    if (rows.length === 0) return [];
    const { data, error } = await sb.from("product_photos").select("id,product_id").in("product_id", rows.map((r) => r.id)).order("created_at").order("id");
    if (error) fail("product photos", error);
    const byProduct = new Map<string, string[]>();
    for (const r of data ?? []) byProduct.set(r.product_id, [...(byProduct.get(r.product_id) ?? []), r.id]);
    return rows.map((r) => ({ ...r, photos: byProduct.get(r.id) ?? [] }));
  };
  const withPhotosOne = async (row: Omit<Product, "photos"> | null): Promise<Product | null> => (row ? (await withPhotos([row]))[0] : null);

  // The image ids of each design, oldest first; the image bytes are never selected here.
  const withImages = async (rows: Omit<Design, "images">[]): Promise<Design[]> => {
    if (rows.length === 0) return [];
    const { data, error } = await sb.from("design_images").select("id,design_id").in("design_id", rows.map((r) => r.id)).order("created_at").order("id");
    if (error) fail("design images", error);
    const byDesign = new Map<string, string[]>();
    for (const r of data ?? []) byDesign.set(r.design_id, [...(byDesign.get(r.design_id) ?? []), r.id]);
    return rows.map((r) => ({ ...r, images: byDesign.get(r.id) ?? [] }));
  };
  const withImagesOne = async (row: Omit<Design, "images"> | null): Promise<Design | null> => (row ? (await withImages([row]))[0] : null);

  return {
    async listActiveProducts() {
      const { data, error } = await sb.from("products").select("*").eq("active", true).order("sort");
      if (error) fail("listActiveProducts", error);
      return withPhotos(data ?? []);
    },

    async getProductBySlug(slug) {
      const { data, error } = await sb.from("products").select("*").eq("slug", slug).eq("active", true).maybeSingle();
      if (error) fail("getProductBySlug", error);
      return withPhotosOne(data);
    },

    async getPhoto(id) {
      const { data, error } = await sb.from("product_photos").select("mime,data").eq("id", id).maybeSingle();
      if (error) fail("getPhoto", error);
      return data ? { mime: data.mime, bytes: Buffer.from(data.data, "base64") } : null;
    },

    async getOpenBatch() {
      const { data, error } = await sb.from("batches").select("*").eq("status", "open").order("opens_at", { ascending: false }).limit(1).maybeSingle();
      if (error) fail("getOpenBatch", error);
      return (data as Batch | null) ?? null;
    },

    async getSettings() {
      const { data, error } = await sb.from("settings").select("value").eq("id", 1).maybeSingle();
      if (error) fail("getSettings", error);
      return data?.value ?? null;
    },

    async saveSettings(value) {
      const { error } = await sb.from("settings").upsert({ id: 1, value });
      if (error) fail("saveSettings", error);
    },

    async getProfile(userId) {
      const { data, error } = await sb.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) fail("getProfile", error);
      return (data as Profile | null) ?? null;
    },

    async createProfile(userId, email, input) {
      const { data, error } = await sb.from("profiles").insert({ id: userId, email, ...input }).select("*").single();
      if (error) {
        if (error.code === "23505") throw new EmailTakenError();
        fail("createProfile", error);
      }
      return data as Profile;
    },

    async updateProfile(userId, input) {
      const { data, error } = await sb.from("profiles").update(input).eq("id", userId).select("*").single();
      if (error) fail("updateProfile", error);
      return data as Profile;
    },

    async countPendingOrders(userId) {
      const { count, error } = await sb
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("payment_status", "pending")
        .neq("order_status", "cancelled");
      if (error) fail("countPendingOrders", error);
      return count ?? 0;
    },

    async insertOrder(order) {
      const { data, error } = await sb.from("orders").insert(order).select("*").single();
      if (error) {
        if (error.code === "23505") throw new CodeTakenError();
        fail("insertOrder", error);
      }
      return data as Order;
    },

    async getOrderByCode(code) {
      const { data, error } = await sb.from("orders").select("*").eq("code", code).maybeSingle();
      if (error) fail("getOrderByCode", error);
      return (data as Order | null) ?? null;
    },

    async listOrdersByUser(userId) {
      const { data, error } = await sb.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      if (error) fail("listOrdersByUser", error);
      return (data ?? []) as Order[];
    },

    async setUtr(code, utr) {
      const { data, error } = await sb.from("orders").update({ utr }).eq("code", code).eq("payment_status", "pending").select("id");
      if (error) fail("setUtr", error);
      return (data?.length ?? 0) > 0;
    },

    async addEvent(orderId, type, note) {
      const { error } = await sb.from("order_events").insert({ order_id: orderId, type, note: note ?? null });
      if (error) fail("addEvent", error);
    },

    async countFreebies() {
      const { count, error } = await sb.from("orders").select("id", { count: "exact", head: true }).eq("freebie", true);
      if (error) fail("countFreebies", error);
      return count ?? 0;
    },

    // ---- admin ----
    async listAllProducts() {
      const { data, error } = await sb.from("products").select("*").order("sort").order("created_at");
      if (error) fail("listAllProducts", error);
      return withPhotos(data ?? []);
    },

    async getProductById(id) {
      const { data, error } = await sb.from("products").select("*").eq("id", id).maybeSingle();
      if (error) fail("getProductById", error);
      return withPhotosOne(data);
    },

    async createProduct(input) {
      const { data, error } = await sb.from("products").insert(input).select("*").single();
      if (error) {
        if (error.code === "23505") throw new SlugTakenError();
        fail("createProduct", error);
      }
      return { ...(data as Omit<Product, "photos">), photos: [] };
    },

    async updateProduct(id, input) {
      const { data, error } = await sb.from("products").update(input).eq("id", id).select("*").maybeSingle();
      if (error) {
        if (error.code === "23505") throw new SlugTakenError();
        fail("updateProduct", error);
      }
      if (!data) throw new NotFoundError("product");
      return (await withPhotosOne(data))!;
    },

    async deleteProduct(id) {
      // A design whose product is going away is no longer live.
      const retire = await sb.from("designs").update({ status: "retired", updated_at: new Date().toISOString() }).eq("product_id", id).eq("status", "live");
      if (retire.error) fail("deleteProduct (retire design)", retire.error);
      const { error } = await sb.from("products").delete().eq("id", id); // its photos go with it (on delete cascade)
      if (error) fail("deleteProduct", error);
    },

    async addProductPhoto(productId, photo: PhotoBlob) {
      const { data, error } = await sb.from("product_photos").insert({ product_id: productId, mime: photo.mime, data: photo.bytes.toString("base64") }).select("id").single();
      if (error) {
        if (error.code === "23503") throw new NotFoundError("product");
        fail("addProductPhoto", error);
      }
      return (data as { id: string }).id;
    },

    async removeProductPhoto(productId, photoId) {
      const { error } = await sb.from("product_photos").delete().eq("id", photoId).eq("product_id", productId);
      if (error) fail("removeProductPhoto", error);
    },

    async listBatches() {
      const { data, error } = await sb.from("batches").select("*").order("opens_at", { ascending: false });
      if (error) fail("listBatches", error);
      return (data ?? []) as Batch[];
    },

    async getBatch(id) {
      const { data, error } = await sb.from("batches").select("*").eq("id", id).maybeSingle();
      if (error) fail("getBatch", error);
      return (data as Batch | null) ?? null;
    },

    async createBatch(input) {
      const { data, error } = await sb.from("batches").insert(input).select("*").single();
      if (error) fail("createBatch", error);
      return data as Batch;
    },

    async updateBatch(id, patch) {
      const { data, error } = await sb.from("batches").update(patch).eq("id", id).select("*").maybeSingle();
      if (error) fail("updateBatch", error);
      if (!data) throw new NotFoundError("batch");
      return data as Batch;
    },

    async searchOrders(f) {
      let q = sb.from("orders").select("*", { count: "exact" });
      if (f.payment) q = q.eq("payment_status", f.payment);
      if (f.status) q = q.eq("order_status", f.status);
      if (f.refund === "open") q = q.in("refund_status", ["requested", "approved"]);
      else if (f.refund) q = q.eq("refund_status", f.refund);
      if (f.batchId) q = q.eq("batch_id", f.batchId);
      const term = f.q ? cleanSearch(f.q) : "";
      if (term) q = q.or(`code.ilike.*${term}*,email.ilike.*${term}*,full_name.ilike.*${term}*,phone.ilike.*${term}*`);
      const { data, error, count } = await q.order("created_at", { ascending: f.sort === "old" }).range(f.offset, f.offset + f.limit - 1);
      if (error) fail("searchOrders", error);
      return { rows: (data ?? []) as Order[], total: count ?? 0 };
    },

    async listOrdersForBatch(batchId) {
      let q = sb.from("orders").select("*");
      if (batchId) q = q.eq("batch_id", batchId);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) fail("listOrdersForBatch", error);
      return (data ?? []) as Order[];
    },

    async getOrderById(id) {
      const { data, error } = await sb.from("orders").select("*").eq("id", id).maybeSingle();
      if (error) fail("getOrderById", error);
      return (data as Order | null) ?? null;
    },

    async patchOrder(id, patch, event) {
      const { data, error } = await sb.rpc("admin_patch_order", { p_id: id, p_patch: patch, p_event_type: event.type, p_event_note: event.note });
      if (error) {
        if (error.code === "P0002") throw new NotFoundError("order");
        fail("patchOrder", error);
      }
      return data as Order;
    },

    async listEvents(orderId) {
      const { data, error } = await sb.from("order_events").select("*").eq("order_id", orderId).order("created_at", { ascending: false }).order("id", { ascending: false });
      if (error) fail("listEvents", error);
      return (data ?? []) as OrderEvent[];
    },

    async listProfiles(query, limit = 100) {
      let q = sb.from("profiles").select("*");
      const term = query ? cleanSearch(query) : "";
      if (term) q = q.or(`full_name.ilike.*${term}*,email.ilike.*${term}*,roll_no.ilike.*${term}*,phone.ilike.*${term}*`);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
      if (error) fail("listProfiles", error);
      return (data ?? []) as Profile[];
    },

    // ---- designers ----
    async getDesigner(userId) {
      const { data, error } = await sb.from("designers").select("*").eq("id", userId).maybeSingle();
      if (error) {
        if (tableMissing(error)) return null;
        fail("getDesigner", error);
      }
      return (data as Designer | null) ?? null;
    },

    async createDesigner(userId, input) {
      const { data, error } = await sb.from("designers").insert({ id: userId, ...input }).select("*").single();
      if (error) {
        if (error.code === "23503") throw new NotFoundError("profile");
        fail("createDesigner", error);
      }
      return data as Designer;
    },

    async updateDesigner(userId, input) {
      const { data, error } = await sb.from("designers").update(input).eq("id", userId).select("*").maybeSingle();
      if (error) fail("updateDesigner", error);
      if (!data) throw new NotFoundError("designer");
      return data as Designer;
    },

    async decideDesigner(userId, decision) {
      const { data, error } = await sb.from("designers").update({ ...decision, decided_at: new Date().toISOString() }).eq("id", userId).select("*").maybeSingle();
      if (error) fail("decideDesigner", error);
      if (!data) throw new NotFoundError("designer");
      return data as Designer;
    },

    async listDesigners(status) {
      let q = sb.from("designers").select("*");
      if (status) q = q.eq("status", status);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) {
        if (tableMissing(error)) return [];
        fail("listDesigners", error);
      }
      const rows = (data ?? []) as Designer[];
      if (rows.length === 0) return [];
      const people = await sb.from("profiles").select("id,full_name,email,phone").in("id", rows.map((r) => r.id));
      if (people.error) fail("listDesigners profiles", people.error);
      const byId = new Map((people.data ?? []).map((p) => [p.id, p]));
      return rows.flatMap((r): DesignerWithProfile[] => {
        const p = byId.get(r.id);
        return p ? [{ ...r, full_name: p.full_name, email: p.email, phone: p.phone }] : [];
      });
    },

    async createDesign(designerId, input) {
      const { data, error } = await sb.from("designs").insert({ designer_id: designerId, ...input }).select("*").single();
      if (error) {
        if (error.code === "23503") throw new NotFoundError("designer");
        fail("createDesign", error);
      }
      return { ...(data as Omit<Design, "images">), images: [] };
    },

    async getDesign(id) {
      const { data, error } = await sb.from("designs").select("*").eq("id", id).maybeSingle();
      if (error) {
        if (tableMissing(error)) return null;
        fail("getDesign", error);
      }
      return withImagesOne(data as Omit<Design, "images"> | null);
    },

    async listDesignsByDesigner(designerId) {
      const { data, error } = await sb.from("designs").select("*").eq("designer_id", designerId).order("created_at", { ascending: false });
      if (error) {
        if (tableMissing(error)) return [];
        fail("listDesignsByDesigner", error);
      }
      return withImages((data ?? []) as Omit<Design, "images">[]);
    },

    async listDesigns(status) {
      let q = sb.from("designs").select("*");
      if (status) q = q.eq("status", status);
      const { data, error } = await q.order("submitted_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
      if (error) {
        if (tableMissing(error)) return [];
        fail("listDesigns", error);
      }
      return withImages((data ?? []) as Omit<Design, "images">[]);
    },

    async patchDesign(id, patch) {
      const { data, error } = await sb.from("designs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("*").maybeSingle();
      if (error) fail("patchDesign", error);
      if (!data) throw new NotFoundError("design");
      return (await withImagesOne(data as Omit<Design, "images">))!;
    },

    async deleteDesign(id) {
      const { error } = await sb.from("designs").delete().eq("id", id); // images go with it (on delete cascade)
      if (error) fail("deleteDesign", error);
    },

    async addDesignImage(designId, image: PhotoBlob) {
      const { data, error } = await sb.from("design_images").insert({ design_id: designId, mime: image.mime, data: image.bytes.toString("base64") }).select("id").single();
      if (error) {
        if (error.code === "23503") throw new NotFoundError("design");
        fail("addDesignImage", error);
      }
      await sb.from("designs").update({ updated_at: new Date().toISOString() }).eq("id", designId);
      return (data as { id: string }).id;
    },

    async removeDesignImage(designId, imageId) {
      const { error } = await sb.from("design_images").delete().eq("id", imageId).eq("design_id", designId);
      if (error) fail("removeDesignImage", error);
      await sb.from("designs").update({ updated_at: new Date().toISOString() }).eq("id", designId);
    },

    async getDesignImage(id) {
      const { data, error } = await sb.from("design_images").select("mime,data,design_id").eq("id", id).maybeSingle();
      if (error) {
        if (tableMissing(error)) return null;
        fail("getDesignImage", error);
      }
      return data ? { mime: data.mime, bytes: Buffer.from(data.data, "base64"), designId: data.design_id } : null;
    },

    async listProductTerms() {
      const { data, error } = await sb.from("product_terms").select("*");
      if (error) {
        if (tableMissing(error)) return [];
        fail("listProductTerms", error);
      }
      return (data ?? []).map(toTerms);
    },

    async getProductTerms(productId) {
      const { data, error } = await sb.from("product_terms").select("*").eq("product_id", productId).maybeSingle();
      if (error) {
        if (tableMissing(error)) return null;
        fail("getProductTerms", error);
      }
      return data ? toTerms(data) : null;
    },

    async saveProductTerms(terms) {
      const { error } = await sb.from("product_terms").upsert({ ...terms, updated_at: new Date().toISOString() });
      if (error) {
        if (error.code === "23503") throw new NotFoundError("product");
        fail("saveProductTerms", error);
      }
    },

    async listOrdersWithDesigner(designerId) {
      // A JSON string, not an array: the client turns arrays into Postgres array syntax, which a jsonb column rejects.
      const { data, error } = await sb.from("orders").select("*").contains("items", JSON.stringify([{ designer: { id: designerId } }])).order("created_at", { ascending: false });
      if (error) fail("listOrdersWithDesigner", error);
      return (data ?? []) as Order[];
    },

    async listPayouts(designerId) {
      let q = sb.from("designer_payouts").select("*");
      if (designerId) q = q.eq("designer_id", designerId);
      const { data, error } = await q.order("paid_at", { ascending: false });
      if (error) {
        if (tableMissing(error)) return [];
        fail("listPayouts", error);
      }
      return (data ?? []) as Payout[];
    },

    async createPayout(input) {
      const { data, error } = await sb.from("designer_payouts").insert(input).select("*").single();
      if (error) {
        if (error.code === "23503") throw new NotFoundError("designer");
        fail("createPayout", error);
      }
      return data as Payout;
    },

    async deletePayout(id) {
      const { error } = await sb.from("designer_payouts").delete().eq("id", id);
      if (error) fail("deletePayout", error);
    },
  };
}

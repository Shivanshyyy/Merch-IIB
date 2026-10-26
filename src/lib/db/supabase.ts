import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Batch, NewOrder, Order, Product } from "@/lib/types";
import { CodeTakenError, type Db } from "./types";

export function createSupabaseDb(url: string, serviceKey: string): Db {
  // Service-role key bypasses RLS; it must never reach client code.
  const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const fail = (what: string, error: { message: string }): never => {
    throw new Error(`supabase ${what}: ${error.message}`);
  };

  return {
    async listActiveProducts() {
      const { data, error } = await sb.from("products").select("*").eq("active", true).order("sort");
      if (error) fail("listActiveProducts", error);
      return (data ?? []) as Product[];
    },

    async getProductBySlug(slug) {
      const { data, error } = await sb.from("products").select("*").eq("slug", slug).eq("active", true).maybeSingle();
      if (error) fail("getProductBySlug", error);
      return (data as Product | null) ?? null;
    },

    async getOpenBatch() {
      const { data, error } = await sb.from("batches").select("*").eq("status", "open").order("opens_at", { ascending: false }).limit(1).maybeSingle();
      if (error) fail("getOpenBatch", error);
      return (data as Batch | null) ?? null;
    },

    async countPendingOrders(email) {
      const { count, error } = await sb
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("email", email)
        .eq("payment_status", "pending")
        .neq("order_status", "cancelled");
      if (error) fail("countPendingOrders", error);
      return count ?? 0;
    },

    async insertOrder(order: NewOrder) {
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

    async listOrdersByEmail(email) {
      const { data, error } = await sb.from("orders").select("*").eq("email", email).order("created_at", { ascending: false });
      if (error) fail("listOrdersByEmail", error);
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
  };
}

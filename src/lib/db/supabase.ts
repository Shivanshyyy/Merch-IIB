import "server-only";
import type { Batch, Order, Product, Profile } from "@/lib/types";
import { CodeTakenError, EmailTakenError, type Db } from "./types";
import type { ServiceClient } from "./supabase-client";

export function createSupabaseDb(sb: ServiceClient): Db {
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
  };
}

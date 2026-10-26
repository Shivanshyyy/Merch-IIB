import type { Settings } from "@/config/site";
import type { Batch, NewOrder, Order, Product, Profile, ProfileInput } from "@/lib/types";

export class CodeTakenError extends Error {
  constructor() {
    super("order code already exists");
  }
}

export class EmailTakenError extends Error {
  constructor() {
    super("a profile with this email already exists");
  }
}

export interface Db {
  // catalogue
  listActiveProducts(): Promise<Product[]>;
  getProductBySlug(slug: string): Promise<Product | null>;
  getOpenBatch(): Promise<Batch | null>;

  // runtime settings: the stored JSON (possibly partial), merged with defaults by the caller
  getSettings(): Promise<unknown | null>;
  saveSettings(value: Settings): Promise<void>;

  // customers
  getProfile(userId: string): Promise<Profile | null>;
  createProfile(userId: string, email: string, data: ProfileInput): Promise<Profile>;
  updateProfile(userId: string, data: ProfileInput): Promise<Profile>;

  // orders
  countPendingOrders(userId: string): Promise<number>;
  insertOrder(order: NewOrder): Promise<Order>;
  getOrderByCode(code: string): Promise<Order | null>;
  listOrdersByUser(userId: string): Promise<Order[]>;
  // Only succeeds while payment is still pending; returns false otherwise.
  setUtr(code: string, utr: string): Promise<boolean>;
  addEvent(orderId: string, type: string, note?: string): Promise<void>;
}

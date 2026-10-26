import type { Batch, NewOrder, Order, Product } from "@/lib/types";

export class CodeTakenError extends Error {
  constructor() {
    super("order code already exists");
  }
}

export interface Db {
  listActiveProducts(): Promise<Product[]>;
  getProductBySlug(slug: string): Promise<Product | null>;
  getOpenBatch(): Promise<Batch | null>;
  countPendingOrders(email: string): Promise<number>;
  insertOrder(order: NewOrder): Promise<Order>;
  getOrderByCode(code: string): Promise<Order | null>;
  listOrdersByEmail(email: string): Promise<Order[]>;
  // Only succeeds while payment is still pending; returns false otherwise.
  setUtr(code: string, utr: string): Promise<boolean>;
  addEvent(orderId: string, type: string, note?: string): Promise<void>;
}

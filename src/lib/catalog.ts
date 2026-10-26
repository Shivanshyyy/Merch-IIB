import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";

// Cached reads for display only. Anything that decides money (checkout) reads db() directly.
export async function getProducts() {
  "use cache";
  cacheTag("products");
  cacheLife("hours");
  return db().listActiveProducts();
}

export async function getProduct(slug: string) {
  "use cache";
  cacheTag("products");
  cacheLife("hours");
  return db().getProductBySlug(slug);
}

export async function getOpenBatch() {
  "use cache";
  cacheTag("batches");
  cacheLife("minutes");
  return db().getOpenBatch();
}

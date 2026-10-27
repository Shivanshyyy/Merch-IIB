import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/catalog";
import { siteUrl } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const products = await getProducts();
  return [
    { url: `${base}/`, priority: 1 },
    { url: `${base}/shop`, priority: 0.9 },
    ...products.map((p) => ({ url: `${base}/shop/${p.slug}`, priority: 0.8 })),
    { url: `${base}/policies`, priority: 0.3 },
  ];
}

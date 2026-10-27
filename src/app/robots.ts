import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// Public pages are open; accounts, carts, orders and the admin panel are nobody else's business.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/cart", "/checkout", "/order", "/orders", "/account", "/login", "/track"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

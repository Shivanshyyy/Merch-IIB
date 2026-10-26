import type { NextConfig } from "next";

// Static assets in public/ are served revalidate-every-time by default; the model and stills change rarely.
const longCache = [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/models/:path*", headers: longCache },
      { source: "/products/:path*", headers: longCache },
    ];
  },
};

export default nextConfig;

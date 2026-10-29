import type { NextConfig } from "next";

// The stills keep their names when re-rendered, so they must be revalidated.
const revalidate = [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Admin photo uploads: the default is 1 MB. Vercel itself refuses bodies over 4.5 MB.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
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
      { source: "/products/:path*", headers: revalidate },
    ];
  },
};

export default nextConfig;

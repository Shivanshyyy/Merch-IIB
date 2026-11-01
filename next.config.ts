import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

// The 3D model is cached for a week, so its address carries a fingerprint of the file (see src/lib/model.ts). Swap the
// model and every browser asks for a new address instead of reusing the old file, whose different materials crash the scene.
const modelFile = join(process.cwd(), "public/models/hoodie.glb");
const model = existsSync(modelFile) ? readFileSync(modelFile) : null;

// The model's address changes with the file, so it can be cached for good. The stills keep their names when they are
// re-rendered, so they must be revalidated or a browser keeps showing the old pictures.
const longCache = [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }];
const revalidate = [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  env: {
    NEXT_PUBLIC_MODEL_VERSION: model ? createHash("sha256").update(model).digest("hex").slice(0, 10) : "none",
    NEXT_PUBLIC_MODEL_BYTES: String(model?.length ?? 0),
  },
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
      { source: "/models/:path*", headers: longCache },
      { source: "/products/:path*", headers: revalidate },
    ];
  },
};

export default nextConfig;

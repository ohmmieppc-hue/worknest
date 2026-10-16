import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Logo uploads (≤ 1MB) go through a Server Action; leave room for multipart overhead.
    serverActions: { bodySizeLimit: "1.2mb" },
  },
  // react-pdf loads fonts and fontkit at runtime; keep it out of the bundle.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Fonts are read from disk by the PDF route.
  outputFileTracingIncludes: {
    "/api/documents/[id]/pdf": ["./assets/fonts/**"],
    "/p/[token]/pdf": ["./assets/fonts/**"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

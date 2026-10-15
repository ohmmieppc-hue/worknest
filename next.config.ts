import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
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

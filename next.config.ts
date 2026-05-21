import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Límite de tamaño para uploads en API Routes (15 MB + margen)
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;

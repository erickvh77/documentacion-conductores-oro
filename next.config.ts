import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Necesario para el Dockerfile multistage (imagen mínima de producción)
  output: "standalone",

  // Permite acceso desde dispositivos en la red local (celulares, tablets)
  allowedDevOrigins: ["192.168.100.90"],

  // Límite de tamaño para uploads en API Routes (15 MB + margen)
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;

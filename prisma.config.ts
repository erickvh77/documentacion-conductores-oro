import { defineConfig } from "prisma/config";

// DATABASE_URL es inyectada automáticamente por Prisma CLI desde el archivo .env
// antes de que este archivo se ejecute — no se necesita dotenv aquí.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});

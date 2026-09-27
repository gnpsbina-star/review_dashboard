import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
  datasource: {
    // Migrations need a direct (non-pooled) connection on Neon; the app itself uses DATABASE_URL.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});

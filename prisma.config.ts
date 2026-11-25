import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Konfigurasi Prisma CLI (`prisma migrate`, `prisma studio`, `prisma db seed`).
 *
 * Prisma 7 tidak lagi membaca URL dari schema.prisma. URL disusun dari variabel DB_* yang
 * sama dengan yang dipakai server (lihat src/config/env.ts), sehingga cukup satu .env.
 * Bila DATABASE_URL diisi, nilai itulah yang dipakai.
 */
function databaseUrl(): string {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  const user = encodeURIComponent(process.env.DB_USER?.trim() || "root");
  const password = process.env.DB_PASSWORD ? `:${encodeURIComponent(process.env.DB_PASSWORD)}` : "";
  const host = process.env.DB_HOST?.trim() || "localhost";
  const port = process.env.DB_PORT?.trim() || "3306";
  const database = process.env.DB_NAME?.trim() || "dinoyo_admin";
  return `mysql://${user}${password}@${host}:${port}/${database}`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Dijalankan oleh `prisma db seed` (npm run db:seed, dan di akhir npm run db:reset).
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl(),
  },
});

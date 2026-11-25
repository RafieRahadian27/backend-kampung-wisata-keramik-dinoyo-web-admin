import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { env } from "../config/env";
import { Prisma, PrismaClient } from "../generated/prisma/client";

/**
 * Satu instance Prisma Client untuk seluruh aplikasi (singleton).
 *
 * Prisma 7 terhubung ke MySQL/MariaDB lewat driver adapter `@prisma/adapter-mariadb`.
 * Adapter mengelola connection pool: hingga `connectionLimit` koneksi TCP disiapkan lalu
 * dipinjam-kembalikan per query, sehingga server tidak membuka koneksi baru setiap request.
 *
 * Semua query Prisma memakai prepared statement — nilai dari klien dikirim terpisah dari
 * teks SQL, jadi input seperti `' OR 1=1 --` hanya dianggap string biasa (anti SQL Injection).
 */
const adapter = new PrismaMariaDb({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  connectionLimit: env.db.connectionLimit,
});

export const prisma = new PrismaClient({
  adapter,
  log: env.isProduction ? ["error"] : ["warn", "error"],
});

/**
 * Prisma Client utama atau klien transaksi (`tx` di dalam `prisma.$transaction`).
 * Repository menerima keduanya sehingga bisa dijalankan di dalam maupun di luar transaksi.
 */
export type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Database Transaction (BEGIN → COMMIT / ROLLBACK).
 * Semua query di dalam `work` memakai koneksi yang sama; bila salah satu langkah throw,
 * seluruh perubahan dibatalkan utuh sehingga data tidak setengah jadi.
 */
export function withTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(work);
}

/** Tabel yang boleh dikunci — nama tabel tidak bisa memakai placeholder, jadi dibatasi lewat tipe. */
type LockableTable = "akun" | "toko" | "produk" | "pengajuan" | "ktp_upload_tokens";

/**
 * Kunci baris (SELECT ... FOR UPDATE) agar tidak diubah transaksi lain sampai COMMIT.
 * Prisma Client tidak punya API row-lock, jadi memakai raw query bertipe; `id` tetap
 * lewat placeholder. Hanya bermakna bila dipanggil dengan klien transaksi.
 */
export async function lockRow(tx: Prisma.TransactionClient, table: LockableTable, id: number | string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: number | string }[]>`SELECT ${Prisma.raw(table === "ktp_upload_tokens" ? "token_hash AS id" : "id")} FROM ${Prisma.raw(`\`${table}\``)} WHERE ${Prisma.raw(table === "ktp_upload_tokens" ? "token_hash" : "id")} = ${id} FOR UPDATE`;
  return rows.length > 0;
}

/**
 * Filter `contains`/`startsWith` Prisma diterjemahkan menjadi LIKE tanpa meng-escape wildcard,
 * sehingga kata kunci "%" atau "_" akan cocok dengan semua baris. Escape dulu agar dianggap teks biasa.
 */
export function likeSafe(keyword: string): string {
  return keyword.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Cek koneksi (dipakai saat start-up dan endpoint /health). */
export async function pingDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

/** Pelanggaran UNIQUE index (kode Prisma P2002), mis. email/slug yang sama didaftarkan bersamaan. */
export function isDuplicateEntry(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

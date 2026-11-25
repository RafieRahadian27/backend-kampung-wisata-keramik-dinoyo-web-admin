import type { NextFunction, Request, Response } from "express";
import { Prisma } from "../generated/prisma/client";
import { HttpError } from "../utils/httpError";

/** Kode error koneksi (Prisma P1xxx & driver MariaDB) → server database mati / kredensial salah / pool penuh. */
const DB_UNAVAILABLE = new Set([
  "P1000",
  "P1001",
  "P1002",
  "P1003",
  "P1017",
  "P2024",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ER_ACCESS_DENIED_ERROR",
  "ER_BAD_DB_ERROR",
  "ER_CON_COUNT_ERROR",
  "ER_GET_CONNECTION_TIMEOUT",
]);

const databaseUnavailable = () =>
  new HttpError(503, "Database sedang tidak dapat dihubungi. Coba lagi beberapa saat.", { code: "DATABASE_UNAVAILABLE" });

/** Terjemahkan error apa pun (HttpError, body-parser, Prisma, bug) menjadi HttpError. */
function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;

  const e = err as { type?: string; status?: number; code?: string; cause?: { code?: string } };
  // Error bawaan express.json(): JSON rusak atau body terlalu besar.
  if (e?.type === "entity.parse.failed") return new HttpError(400, "Body JSON tidak valid", { code: "INVALID_JSON" });
  if (e?.type === "entity.too.large") return new HttpError(413, "Ukuran body request terlalu besar", { code: "PAYLOAD_TOO_LARGE" });

  if (err instanceof Prisma.PrismaClientInitializationError) return databaseUnavailable();
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Kode error Prisma: https://www.prisma.io/docs/orm/reference/error-reference
    if (err.code === "P2002") return new HttpError(409, "Data yang sama sudah terdaftar");
    if (err.code === "P2003") return new HttpError(422, "Data relasi tidak ditemukan");
    if (err.code === "P2025") return new HttpError(404, "Data tidak ditemukan");
  }
  if ((e?.code && DB_UNAVAILABLE.has(e.code)) || (e?.cause?.code && DB_UNAVAILABLE.has(e.cause.code))) return databaseUnavailable();

  return new HttpError(500, "Terjadi kesalahan pada server", { code: "INTERNAL_ERROR" });
}

export function notFoundHandler(req: Request, _res: Response) {
  throw new HttpError(404, `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan`, { code: "ROUTE_NOT_FOUND" });
}

/**
 * Error-handling middleware terpusat — dikenali Express dari jumlah parameternya (4),
 * jadi `next` wajib ditulis walau tidak dipakai. Dipasang PALING AKHIR di app.ts.
 *
 * Di Express 5, Promise yang reject dari handler/middleware async (mis. query MySQL gagal)
 * otomatis diteruskan ke sini, sehingga tidak menjadi Unhandled Promise Rejection yang
 * bisa mematikan server. (Di Express 4 hal ini TIDAK otomatis — handler async wajib
 * `try/catch` + `next(err)` atau dibungkus async wrapper.) Sebagai jaring pengaman terakhir,
 * lihat juga handler `process.on("unhandledRejection")` di index.ts.
 *
 * - Error yang dikenal (HttpError, JSON rusak, Prisma P2xxx) → status 4xx/503 + pesan aslinya.
 * - Error tak terduga (bug) → 500 + pesan UMUM. Pesan asli & stack trace hanya masuk log
 *   (bersama requestId), tidak pernah dikirim ke klien di environment mana pun.
 */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  // Bila sebagian response sudah terkirim, status & header tidak bisa diubah lagi:
  // catat, lalu serahkan ke handler bawaan Express yang menutup koneksi.
  if (res.headersSent) {
    req.log.error({ err }, "Error setelah header respons terkirim");
    return next(err);
  }

  const error = toHttpError(err);
  // pino-http menulis `res.err` ke baris log request (lengkap dengan stack), jadi tidak perlu log ganda.
  if (error.status >= 500) res.err = err instanceof Error ? err : new Error(String(err));

  res.status(error.status).json({
    success: false,
    message: error.message,
    error: {
      code: error.code,
      ...(error.details !== undefined ? { details: error.details } : {}),
    },
    meta: { requestId: req.context?.requestId, timestamp: new Date().toISOString() },
  });
}

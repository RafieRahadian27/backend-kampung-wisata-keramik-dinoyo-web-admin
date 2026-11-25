import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { normalizeIdentifier } from "../lib/validate";
import { HttpError } from "../utils/httpError";

/**
 * Rate limiter (fixed window, disimpan di memori proses) — membatasi percobaan berulang
 * pada endpoint publik seperti login dan pendaftaran untuk menahan brute force / spam.
 *
 * Ini perlindungan TAMBAHAN, bukan pengganti validasi input maupun verifikasi kata sandi.
 * Catatan: penyimpanan di memori hanya cocok untuk satu proses server; bila API dijalankan
 * di beberapa instance, pindahkan `hits` ke penyimpanan bersama (mis. Redis).
 */
interface RateLimitOptions {
  /** Panjang jendela waktu. */
  windowMs: number;
  /** Jumlah percobaan maksimal per kunci di dalam satu jendela. */
  max: number;
  /** Kunci pengelompokan, mis. IP atau IP + identitas login. */
  key: (req: Request) => string;
  /**
   * Request mana yang dihitung:
   * - "all"       → semua request (default)
   * - "failed"    → hanya respons gagal (status ≥ 400)
   * - "succeeded" → hanya respons sukses (mis. jumlah akun yang berhasil didaftarkan)
   */
  count?: "all" | "failed" | "succeeded";
  /** Respons sukses menghapus hitungan (mis. login berhasil = bukan penyerang). */
  resetOnSuccess?: boolean;
  message: (retryMinutes: number) => string;
}

interface Hit {
  count: number;
  resetAt: number;
}

/** Semua limiter didaftarkan di sini agar entri kedaluwarsa bisa dibersihkan berkala. */
const stores = new Set<Map<string, Hit>>();

setInterval(() => {
  const now = Date.now();
  for (const hits of stores) {
    for (const [key, hit] of hits) if (hit.resetAt <= now) hits.delete(key);
  }
}, 60_000).unref();

export function rateLimit({ windowMs, max, key, count = "all", resetOnSuccess = false, message }: RateLimitOptions) {
  const hits = new Map<string, Hit>();
  stores.add(hits);

  return (req: Request, res: Response, next: NextFunction) => {
    const id = key(req);
    const now = Date.now();
    const current = hits.get(id);
    const hit = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };

    res.set("RateLimit-Limit", String(max));
    if (hit.count >= max) {
      const retrySeconds = Math.ceil((hit.resetAt - now) / 1000);
      res.set("RateLimit-Remaining", "0");
      res.set("Retry-After", String(retrySeconds));
      throw new HttpError(429, message(Math.ceil(retrySeconds / 60)));
    }

    // Kuota "dipesan" sebelum handler berjalan, sehingga banyak request paralel tidak bisa
    // lolos bersamaan sebelum ada yang selesai. Hasilnya dikoreksi setelah response terkirim.
    hit.count += 1;
    hits.set(id, hit);
    res.set("RateLimit-Remaining", String(max - hit.count));

    res.once("finish", () => {
      // 429 dari limiter lain tidak pernah sampai ke pemeriksaan kata sandi → tidak dihitung sebagai percobaan.
      if (res.statusCode === 429) {
        hit.count = Math.max(0, hit.count - 1);
        return;
      }
      const succeeded = res.statusCode < 400;
      if (succeeded && resetOnSuccess) {
        hits.delete(id);
        return;
      }
      const counted = count === "all" || (count === "failed" ? !succeeded : succeeded);
      if (!counted) hit.count = Math.max(0, hit.count - 1);
    });
    next();
  };
}

const MINUTE = 60 * 1000;
const clientIp = (req: Request) => req.ip ?? "unknown";

/**
 * Batas umum seluruh /api per IP (default 300 request / 15 menit, atur lewat RATE_LIMIT_*).
 * Lapisan kasar penahan flood; endpoint sensitif punya limiter sendiri yang jauh lebih ketat.
 * /api/health dikecualikan agar pemantauan uptime tidak ikut terblokir.
 */
const generalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMinutes * MINUTE,
  max: env.rateLimit.max,
  key: clientIp,
  message: (menit) => `Terlalu banyak permintaan dari jaringan ini. Coba lagi dalam ${menit} menit.`,
});

export function apiLimiter(req: Request, res: Response, next: NextFunction) {
  if (req.path === "/api/health") return next();
  return generalLimiter(req, res, next);
}

/** Unggah berkas per pengguna: 20 kali per 15 menit — tiap unggahan memakan kuota & biaya storage. */
/** Unggah foto KTP pra-registrasi: 5 kali per jam per IP anonim agar tidak disalahgunakan untuk spam Blob storage. */
export const registerKtpUploadLimiter = rateLimit({
  windowMs: 60 * MINUTE,
  max: 5,
  key: clientIp,
  message: (menit) => `Terlalu banyak unggahan foto KTP dari jaringan ini. Coba lagi dalam ${menit} menit.`,
});

export const uploadLimiter = rateLimit({
  windowMs: 15 * MINUTE,
  max: 20,
  key: (req) => `user:${req.user?.id ?? clientIp(req)}`,
  message: (menit) => `Terlalu banyak unggahan. Coba lagi dalam ${menit} menit.`,
});

/** Login gagal per (IP + email/username): 5 kali per 15 menit. Login berhasil mereset hitungan. */
export const loginLimiter = rateLimit({
  windowMs: 15 * MINUTE,
  max: 5,
  key: (req) => `${clientIp(req)}|${normalizeIdentifier((req.body as { identifier?: unknown } | undefined)?.identifier)}`,
  count: "failed",
  resetOnSuccess: true,
  message: (menit) => `Terlalu banyak percobaan login. Coba lagi dalam ${menit} menit.`,
});

/**
 * Lapisan kedua: satu IP yang mencoba banyak akun berbeda (credential stuffing) — 20 gagal per 15 menit.
 * Tidak di-reset oleh login sukses, agar penyerang tidak bisa "mengosongkan" hitungan dengan akunnya sendiri.
 */
export const loginIpLimiter = rateLimit({
  windowMs: 15 * MINUTE,
  max: 20,
  key: clientIp,
  count: "failed",
  message: (menit) => `Terlalu banyak percobaan login dari jaringan ini. Coba lagi dalam ${menit} menit.`,
});

/**
 * Ganti kata sandi gagal per pengguna: 5 kali per 15 menit — mencegah sesi yang dibajak
 * dipakai menebak kata sandi lama. Penggantian berhasil mereset hitungan.
 */
export const passwordLimiter = rateLimit({
  windowMs: 15 * MINUTE,
  max: 5,
  key: (req) => `user:${req.user?.id ?? clientIp(req)}`,
  count: "failed",
  resetOnSuccess: true,
  message: (menit) => `Terlalu banyak percobaan mengganti kata sandi. Coba lagi dalam ${menit} menit.`,
});

/** Pendaftaran berhasil per IP: 5 akun per jam, agar endpoint publik tidak dipakai membanjiri tabel akun. */
export const registerLimiter = rateLimit({
  windowMs: 60 * MINUTE,
  max: 5,
  key: clientIp,
  count: "succeeded",
  message: () => "Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti.",
});

export const aiCuratorLimiter = rateLimit({
  windowMs: 1 * MINUTE,
  max: 15,
  key: (req) => `ai_curator:${req.ip ?? ""}`,
  message: "Terlalu banyak permintaan konsultasi AI. Tunggu 1 menit.",
});

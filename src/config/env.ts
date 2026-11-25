import "dotenv/config";

/**
 * Semua kredensial dibaca dari file `.env` (dimuat oleh dotenv), bukan ditulis di kode.
 * File `.env` masuk .gitignore sehingga password database tidak ikut ter-commit.
 */
function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Variabel lingkungan ${name} wajib diisi (lihat backend/.env.example)`);
  }
  return value.trim();
}

const isProduction = process.env.NODE_ENV === "production";

/**
 * `trust proxy` Express: "loopback" (default) = hanya percaya X-Forwarded-For dari mesin yang sama
 * (Server Action Next.js). Di belakang load balancer/CDN isi TRUST_PROXY, mis. "1" (satu hop) atau
 * daftar IP/subnet proxy, agar `req.ip` = IP pengguna asli dan tidak bisa dipalsukan.
 */
function trustProxy(value = "loopback"): boolean | number | string {
  if (value === "true" || value === "false") return value === "true";
  return /^\d+$/.test(value) ? Number(value) : value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  // Bisa lebih dari satu origin, pisahkan dengan koma. Di production WAJIB diisi eksplisit.
  clientOrigins: (isProduction ? required("CLIENT_ORIGIN") : (process.env.CLIENT_ORIGIN ?? "http://localhost:3000"))
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean),
  isProduction,
  isTest: process.env.NODE_ENV === "test",
  trustProxy: trustProxy(process.env.TRUST_PROXY?.trim() || undefined),
  /** trace | debug | info | warn | error | fatal | silent */
  logLevel: process.env.LOG_LEVEL?.trim() || (process.env.NODE_ENV === "test" ? "silent" : "info"),
  sessionCookie: process.env.SESSION_COOKIE?.trim() || "kd_api_session",
  rateLimit: {
    /** Batas umum per IP untuk seluruh /api — sesuaikan dengan pola trafik panel. */
    windowMinutes: Number(process.env.RATE_LIMIT_WINDOW_MINUTES ?? 15),
    max: Number(process.env.RATE_LIMIT_MAX ?? 300),
  },
  blob: {
    /** Token Vercel Blob (Storage → Blob → .env.local). Kosong = fitur unggah dimatikan (503). */
    publicToken: process.env.BLOB_PUBLIC_READ_WRITE_TOKEN?.trim() || process.env.BLOB_READ_WRITE_TOKEN?.trim() || undefined,
    privateToken: process.env.BLOB_PRIVATE_READ_WRITE_TOKEN?.trim() || process.env.BLOB_READ_WRITE_TOKEN?.trim() || undefined,
    token: process.env.BLOB_READ_WRITE_TOKEN?.trim() || undefined,
    /** Ukuran maksimal foto sampul toko (byte). */
    maxFotoBytes: Number(process.env.UPLOAD_MAX_FOTO_BYTES ?? 2 * 1024 * 1024),
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY?.trim() || undefined,
    model: process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite",
  },
  db: {
    host: process.env.DB_HOST?.trim() || "localhost",
    port: Number(process.env.DB_PORT ?? 3306),
    user: required("DB_USER"),
    // Password boleh kosong (default XAMPP), jadi tidak memakai `required`.
    password: process.env.DB_PASSWORD ?? "",
    database: required("DB_NAME"),
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 10),
  },
};




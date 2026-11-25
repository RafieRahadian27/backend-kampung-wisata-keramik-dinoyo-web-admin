import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/logger";
import { normalizeHeaders } from "./middleware/normalizeHeaders";
import { apiLimiter } from "./middleware/rateLimiter";
import { requestContext } from "./middleware/requestContext";
import { requireJson } from "./middleware/requireJson";
import { responseFormatter } from "./middleware/responseFormatter";
import { securityHeaders } from "./middleware/securityHeaders";
import apiRouter from "./routes";

/**
 * Urutan `app.use` = urutan eksekusi middleware. Setiap request melewati "pos pemeriksaan"
 * di bawah dari atas ke bawah; tiap pos memanggil next() untuk meneruskan, atau
 * menghentikan alur dengan mengirim response / melempar error.
 *
 *   1. request ID + request logger  → paling awal, agar request yang ditolak pos berikutnya pun tercatat
 *   2. Helmet (header keamanan)
 *   3. rate limiter umum            → 429
 *   3b. kompresi response (gzip/deflate/br sesuai Accept-Encoding)
 *   4. CORS, cookie, parser body
 *   5. routes
 *   6. handler 404 → error handler  → paling akhir
 */
export function createApp() {
  const app = express();
  // Login & daftar dipanggil dari Server Action Next.js di mesin yang sama. Secara default header
  // X-Forwarded-For hanya dipercaya dari loopback, sehingga `req.ip` = IP pengguna asli (untuk
  // pembatasan percobaan) dan tidak bisa dipalsukan klien dari luar. Atur TRUST_PROXY bila
  // API di-deploy di belakang reverse proxy / load balancer.
  app.set("trust proxy", env.trustProxy);

  // ── 1. Observabilitas: request ID (dipakai logger sebagai reqId) lalu log terstruktur ──
  app.use(requestContext);
  app.use(requestLogger);

  // ── 2. Header keamanan (Helmet) — juga menghapus X-Powered-By ──
  app.use(securityHeaders);

  // ── 3. Rate limit umum per IP ──
  app.use(apiLimiter);

  // ── 3b. Kompresi: JSON daftar toko/produk/laporan menyusut ±70–80% sebelum dikirim ke Next.js.
  // Response < 1 KB dilewati (default `threshold`) karena overhead kompresinya lebih besar dari hematnya.
  // Untuk trafik tinggi, kompresi sebaiknya dipindah ke reverse proxy (Nginx) agar tidak memakan CPU Node.
  app.use(compression());

  // ── 4. Augmentasi request/response, CORS, cookie, parser body ──
  app.use(normalizeHeaders);
  app.use(responseFormatter);
  app.use(
    cors({
      origin(origin, callback) {
        // Production: HANYA origin di CLIENT_ORIGIN. Development: localhost/127.0.0.1 di port mana pun
        // (mis. Next.js pindah ke 3001). Request tanpa Origin (server-to-server, curl) tidak terkena CORS.
        const isLocalDev = !env.isProduction && !!origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
        callback(null, !origin || isLocalDev || env.clientOrigins.includes(origin));
      },
      credentials: true, // izinkan cookie sesi ikut terkirim dari origin yang diizinkan
      exposedHeaders: ["X-Request-Id", "Retry-After", "RateLimit-Limit", "RateLimit-Remaining"],
    }),
  );
  app.use(cookieParser()); // mengisi req.cookies
  // Built-in: parsing body JSON (maks. 100 KB). Rute unggah berkas memakai parser biner sendiri.
  app.use(requireJson);
  app.use(express.json({ limit: "100kb" }));

  // ── 5. Router-level: modul rute per fitur ──
  app.use("/api", apiRouter);

  // ── 6. Penutup: 404 & error-handling middleware (harus paling akhir) ──
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

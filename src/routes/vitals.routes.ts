import { Router, type Request } from "express";
import { authenticate, currentUser } from "../middleware/authMiddleware";
import { noStore } from "../middleware/cacheControl";
import { rateLimit } from "../middleware/rateLimiter";
import { HttpError } from "../utils/httpError";

/**
 * Data LAPANGAN Core Web Vitals (RUM) — angka yang dirasakan pengguna sungguhan, bukan Lighthouse.
 *
 * Browser → Route Handler Next.js `/api/vitals` (menambahkan token sesi) → POST /api/vitals di sini
 * → satu baris log Pino per metrik. Dari log itu persentil ke-75 per halaman bisa dihitung
 * (patokan: LCP ≤ 2500 ms, INP ≤ 200 ms, CLS ≤ 0,1).
 *
 * Hanya pengguna yang login yang dicatat: panel ini privat, dan endpoint publik tanpa autentikasi
 * mudah dibanjiri data palsu.
 */
const METRIK = ["LCP", "INP", "CLS", "FCP", "TTFB"] as const;
const RATING = ["good", "needs-improvement", "poor"] as const;
const NAVIGASI = ["navigate", "reload", "back-forward", "back-forward-cache", "prerender", "restore"] as const;
const MAKS_METRIK_PER_LAPORAN = 10;

interface Vital {
  name: (typeof METRIK)[number];
  value: number;
  rating: (typeof RATING)[number];
  navigationType?: (typeof NAVIGASI)[number];
}

const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T => typeof value === "string" && list.includes(value as T);

/** Validasi manual: skema umum (utils/schema.ts) belum mendukung array berisi objek. */
function parseLaporan(body: unknown): { halaman: string; metrik: Vital[] } {
  const input = (body ?? {}) as { halaman?: unknown; metrik?: unknown };
  const halaman = typeof input.halaman === "string" ? input.halaman.trim() : "";
  if (!halaman.startsWith("/") || halaman.length > 200) throw new HttpError(422, "Halaman harus berupa path, mis. /dashboard");
  if (!Array.isArray(input.metrik) || input.metrik.length === 0 || input.metrik.length > MAKS_METRIK_PER_LAPORAN) {
    throw new HttpError(422, `Metrik harus berisi 1–${MAKS_METRIK_PER_LAPORAN} item`);
  }

  const metrik = input.metrik.map((raw, index): Vital => {
    const item = (raw ?? {}) as Record<string, unknown>;
    // CLS tak bersatuan (0–∞, wajarnya < 1); metrik lain dalam milidetik. Batas 10 menit menyaring nilai rusak.
    const valid =
      isOneOf(METRIK, item.name) &&
      typeof item.value === "number" &&
      Number.isFinite(item.value) &&
      item.value >= 0 &&
      item.value <= 600_000 &&
      isOneOf(RATING, item.rating) &&
      (item.navigationType === undefined || isOneOf(NAVIGASI, item.navigationType));
    if (!valid) throw new HttpError(422, `Metrik ke-${index + 1} tidak valid`);
    return { name: item.name as Vital["name"], value: item.value as number, rating: item.rating as Vital["rating"], navigationType: item.navigationType as Vital["navigationType"] };
  });

  return { halaman, metrik };
}

/** Satu laporan per kunjungan halaman; 60/menit per pengguna sudah jauh di atas pemakaian wajar. */
const vitalsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  key: (req: Request) => `vitals:${req.user?.id ?? req.ip}`,
  message: () => "Terlalu banyak laporan performa. Coba lagi sebentar lagi.",
});

const router = Router();

/** POST /api/vitals — body: { halaman: "/dashboard", metrik: [{ name: "LCP", value: 1234, rating: "good" }] } */
router.post("/", noStore, authenticate, vitalsLimiter, (req, res) => {
  const { halaman, metrik } = parseLaporan(req.body);
  const user = currentUser(req);
  // Pino menulis secara asinkron (tidak memblokir event loop seperti console.log).
  for (const vital of metrik) {
    req.log.info({ webVital: { ...vital, halaman, role: user.role } }, `web-vital ${vital.name} ${halaman}`);
  }
  res.status(204).end();
});

export default router;

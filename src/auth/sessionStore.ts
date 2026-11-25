import { createHash, randomBytes } from "node:crypto";
import { type Db, prisma } from "../lib/prisma";

/**
 * Penyimpanan sesi di sisi server — tabel `sessions` (model Prisma `Session`).
 *
 * - Token = 32 byte acak (256 bit) → mustahil ditebak.
 * - Yang disimpan hanya SHA-256 dari token, sehingga bocornya isi tabel
 *   tidak bisa langsung dipakai untuk membajak sesi.
 * - Karena stateful, sesi bisa dicabut seketika (logout, akun ditangguhkan).
 */
const HOUR = 60 * 60 * 1000;
export const SESSION_TTL = { default: 12 * HOUR, remember: 30 * 24 * HOUR };

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export interface SessionClient {
  ipAddress?: string;
  userAgent?: string;
}

export const sessionStore = {
  /** Selalu membuat ID baru — login berarti rotasi sesi (mencegah session fixation). */
  async create(userId: number, remember: boolean, client: SessionClient = {}) {
    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    const ttl = remember ? SESSION_TTL.remember : SESSION_TTL.default;
    const expiresAt = new Date(now.getTime() + ttl);
    await prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId,
        createdAt: now,
        expiresAt,
        ipAddress: client.ipAddress?.slice(0, 45),
        userAgent: client.userAgent?.slice(0, 255),
      },
    });
    return { token, expiresAt, maxAgeMs: ttl };
  },

  async revoke(token: string) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  },

  /** Cabut semua sesi pengguna yang tertaut ke akun pengrajin (bisa dijalankan di dalam transaksi). */
  async revokeByAkun(db: Db, akunId: number) {
    const result = await db.session.deleteMany({ where: { user: { akunId } } });
    return result.count;
  },

  /** Cabut semua sesi pengguna KECUALI sesi yang sedang dipakai (ganti sandi / keluar dari perangkat lain). */
  async revokeOthers(db: Db, userId: number, keepTokenHash: string) {
    const result = await db.session.deleteMany({ where: { userId, tokenHash: { not: keepTokenHash } } });
    return result.count;
  },

  /** Bersihkan sesi kedaluwarsa agar tabel tidak terus membesar. */
  async purgeExpired() {
    await prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  },
};

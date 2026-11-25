import { type Db, prisma } from "../lib/prisma";
import type { Role, StatusAkun } from "../types";

/** Data kredensial untuk login — termasuk hash kata sandi, jadi tidak pernah dikirim ke klien. */
export interface UserCredential {
  id: number;
  nama: string;
  sapaan: string;
  email: string;
  role: Role;
  passwordHash: string;
  akunId: number | null;
  akunStatus: StatusAkun | null;
}

export interface SessionUser {
  id: number;
  nama: string;
  sapaan: string;
  email: string;
  role: Role;
  akunId: number | null;
  tokoSlugs: string[];
}

export type TakenField = "email" | "username" | "nik";

export const userRepository = {
  async findByIdentifier(identifier: string): Promise<UserCredential | undefined> {
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
      select: {
        id: true,
        nama: true,
        sapaan: true,
        email: true,
        role: true,
        passwordHash: true,
        akunId: true,
        akun: { select: { status: true } },
      },
    });
    if (!user) return undefined;
    const { akun, ...rest } = user;
    return { ...rest, akunStatus: akun?.status ?? null };
  },

  /**
   * Field pendaftaran yang sudah dipakai. Email dicek di `users` dan `akun` karena
   * keduanya UNIQUE; NIK hanya ada di `akun`.
   */
  async findTakenFields(db: Db, { email, username, nik }: { email: string; username: string; nik: string }) {
    const [users, akun] = await Promise.all([
      db.user.findMany({ where: { OR: [{ email }, { username }] }, select: { email: true, username: true } }),
      db.akun.findMany({ where: { OR: [{ email }, { nik }] }, select: { email: true, nik: true } }),
    ]);
    const taken = new Set<TakenField>();
    // Kolasi utf8mb4_unicode_ci tidak membedakan huruf besar/kecil, jadi bandingkan dengan cara yang sama.
    const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
    for (const user of users) {
      if (same(user.email, email)) taken.add("email");
      if (same(user.username, username)) taken.add("username");
    }
    for (const row of akun) {
      if (same(row.email, email)) taken.add("email");
      if (row.nik === nik) taken.add("nik");
    }
    return taken;
  },

  async insert(db: Db, user: { nama: string; sapaan: string; email: string; username: string; passwordHash: string; akunId: number }) {
    const row = await db.user.create({ data: { ...user, role: "pengrajin" }, select: { id: true } });
    return row.id;
  },

  /** Pengguna login yang tertaut ke satu akun pengrajin, beserta jumlah toko miliknya. */
  async findByAkunId(db: Db, akunId: number) {
    const users = await db.user.findMany({ where: { akunId }, select: { id: true, _count: { select: { toko: true } } } });
    return users.map((user) => ({ id: user.id, jumlahToko: user._count.toko }));
  },

  /** Profil pengguna sendiri (halaman Profil & Keamanan) — tanpa hash kata sandi. */
  async findProfil(id: number) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        nama: true,
        sapaan: true,
        email: true,
        username: true,
        lastLoginAt: true,
        akun: { select: { nik: true, whatsapp: true, toko: true, lokasi: true, peran: true, status: true } },
        toko: { select: { toko: { select: { slug: true, nama: true } } }, orderBy: { tokoId: "asc" } },
      },
    });
    if (!user) return undefined;
    return { ...user, toko: user.toko.map((item) => item.toko) };
  },

  /** Hash + identitas untuk verifikasi & aturan kekuatan kata sandi baru. */
  async findPasswordContext(id: number) {
    return (await prisma.user.findUnique({ where: { id }, select: { passwordHash: true, username: true, email: true } })) ?? undefined;
  },

  async updateSapaan(db: Db, id: number, sapaan: string) {
    await db.user.update({ where: { id }, data: { sapaan } });
  },

  async updatePassword(db: Db, id: number, passwordHash: string) {
    await db.user.update({ where: { id }, data: { passwordHash } });
  },

  async listSessions(userId: number, now: Date) {
    return prisma.session.findMany({
      where: { userId, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      select: { tokenHash: true, createdAt: true, expiresAt: true, ipAddress: true, userAgent: true },
    });
  },

  async touchLastLogin(db: Db, id: number, at: Date) {
    await db.user.update({ where: { id }, data: { lastLoginAt: at } });
  },

  /** Satu query: cocokkan hash token yang belum kedaluwarsa + ambil daftar toko pengguna. */
  async findBySessionHash(tokenHash: string, now: Date): Promise<SessionUser | undefined> {
    const session = await prisma.session.findUnique({
      where: { tokenHash, expiresAt: { gt: now } },
      select: {
        user: {
          select: {
            id: true,
            nama: true,
            sapaan: true,
            email: true,
            role: true,
            akunId: true,
            toko: { select: { toko: { select: { slug: true } } }, orderBy: { tokoId: "asc" } },
          },
        },
      },
    });
    if (!session) return undefined;
    const { toko, ...user } = session.user;
    return { ...user, tokoSlugs: toko.map((item) => item.toko.slug) };
  },
};

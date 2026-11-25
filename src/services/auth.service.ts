import { hashPassword, hashPasswordSync, verifyPassword } from "../auth/password";
import { permissionsOf, ROLE_LABEL } from "../auth/policy";
import { createHash } from "node:crypto";
import { hashToken, type SessionClient, sessionStore } from "../auth/sessionStore";
import { isDuplicateEntry, lockRow, prisma, withTransaction } from "../lib/prisma";
import { normalizeEmail, normalizeIdentifier } from "../lib/validate";
import { akunRepository } from "../repositories/akun.repository";
import { auditRepository } from "../repositories/audit.repository";
import { pengajuanRepository } from "../repositories/pengajuan.repository";
import { type SessionUser, type TakenField, type UserCredential, userRepository } from "../repositories/user.repository";
import type { AdminUser, AuthenticatedUser, PeranAkun } from "../types";
import { HttpError } from "../utils/httpError";
import type { FieldError } from "../utils/schema";
import { slugify } from "../utils/slugify";

/** Hash palsu agar verifikasi tetap berjalan walau user tidak ada (waktu respons seragam). */
const DUMMY_HASH = hashPasswordSync("dummy-password-tidak-dipakai");

/** Pengrajin hanya boleh masuk bila akunnya berstatus aktif. */
function assertAccountActive(user: UserCredential) {
  if (user.akunId === null) return;
  if (user.akunStatus === "ditangguhkan") throw new HttpError(403, "Akun Anda ditangguhkan. Hubungi admin paguyuban.");
  if (user.akunStatus !== "aktif") throw new HttpError(403, "Akun Anda belum diaktifkan oleh admin paguyuban.");
}

/** Transformasi field: hanya kolom yang aman yang dipetakan — hash kata sandi tidak pernah ikut. */
function toPublicUser(user: SessionUser): AuthenticatedUser {
  return {
    id: user.id,
    nama: user.nama,
    sapaan: user.sapaan,
    email: user.email,
    peran: ROLE_LABEL[user.role],
    role: user.role,
    izin: permissionsOf(user.role),
    tokoSlugs: user.tokoSlugs,
    akunId: user.akunId,
  };
}

/** Label "terakhir aktif" di menu Kelola Akun, mis. "4 Nov 2026, 10.15". */
const labelWaktu = (date: Date) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(date);

interface LoginInput {
  identifier: string;
  password: string;
  remember: boolean;
  client: SessionClient;
}

export interface RegisterInput {
  nama: string;
  umur: number;
  nik: string;
  whatsapp: string;
  toko: string;
  lokasi: string;
  peran: PeranAkun;
  username: string;
  email: string;
  password: string;
  ktpUploadToken: string;
}

const TAKEN_MESSAGE: Record<TakenField, string> = {
  email: "Email sudah terdaftar",
  username: "Username sudah dipakai",
  nik: "NIK sudah terdaftar",
};

function conflictError(fields: Iterable<TakenField>) {
  const details: FieldError[] = [...fields].map((field) => ({ field, message: TAKEN_MESSAGE[field] }));
  return new HttpError(409, details.length === 1 ? details[0].message : "Beberapa data sudah terdaftar", { details });
}

const inisialDari = (nama: string) =>
  nama
    .split(/\s+/)
    .filter((kata) => /^\p{L}/u.test(kata))
    .slice(0, 2)
    .map((kata) => kata[0].toUpperCase())
    .join("") || "?";

/**
 * Pembatasan percobaan login/daftar dilakukan sebelum service ini dipanggil,
 * oleh middleware `rateLimiter` di routes/auth.routes.ts.
 */
export const authService = {
  async login({ identifier, password, remember, client }: LoginInput) {
    const user = await userRepository.findByIdentifier(normalizeIdentifier(identifier));
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      // Pesan sengaja sama untuk email salah maupun sandi salah (tidak membocorkan akun terdaftar).
      throw new HttpError(401, "Email/username atau kata sandi salah");
    }
    // Status akun dicek SETELAH sandi benar agar status tidak bisa diintip orang lain.
    assertAccountActive(user);

    // Operasi I/O independen dijalankan paralel (non-blocking), lalu ditunggu bersama.
    const now = new Date();
    const [session] = await Promise.all([
      sessionStore.create(user.id, remember, client),
      sessionStore.purgeExpired(),
      userRepository.touchLastLogin(prisma, user.id, now),
      user.akunId !== null ? akunRepository.touchTerakhirAktif(prisma, user.akunId, labelWaktu(now)) : undefined,
    ]);
    const profile = await this.resolveSession(session.token);
    if (!profile) throw new HttpError(500, "Sesi gagal dibuat");
    const { akunId: _akunId, ...publicProfile } = profile;
    return { ...session, user: publicProfile };
  },

  /**
   * Pendaftaran mandiri pengrajin. Akun dibuat berstatus "menunggu" sehingga belum bisa
   * login sampai admin mengaktifkannya di menu Kelola Akun (lihat `assertAccountActive`).
   * Baris `akun` + `users` + audit ditulis dalam satu transaksi Prisma.
   */
  async register(input: RegisterInput) {
    const email = normalizeEmail(input.email);
    const username = input.username.toLowerCase();
    const nama = input.nama.replace(/\s+/g, " ");

    const taken = await userRepository.findTakenFields(prisma, { email, username, nik: input.nik });
    if (taken.size > 0) throw conflictError(taken);

    const passwordHash = await hashPassword(input.password);
    try {
      const result = await withTransaction(async (tx) => {
        const tokenHash = createHash("sha256").update(input.ktpUploadToken).digest("hex");
        if (!(await lockRow(tx, "ktp_upload_tokens", tokenHash))) throw new HttpError(422, "Token unggahan KTP tidak valid atau kedaluwarsa");
        const upload = await tx.ktpUploadToken.findUnique({ where: { tokenHash } });
        if (!upload || upload.expiresAt <= new Date()) throw new HttpError(422, "Token unggahan KTP tidak valid atau kedaluwarsa");
        await tx.ktpUploadToken.delete({ where: { tokenHash } });
        const akunId = await akunRepository.insert(tx, {
          nama,
          umur: input.umur,
          inisial: inisialDari(nama),
          nik: input.nik,
          fotoKtp: upload.pathname,
          email,
          toko: input.toko,
          lokasi: input.lokasi,
          peran: input.peran,
          whatsapp: input.whatsapp,
        });
        const userId = await userRepository.insert(tx, { nama, sapaan: nama, email, username, passwordHash, akunId });
        await auditRepository.insert(tx, { userId, aksi: "akun:daftar", target: nama, detail: `${input.peran} · ${input.toko}` });

        // ponytail: sinkronkan pengajuan toko langsung saat pendaftaran pengrajin
        let tokoSlug = slugify(input.toko);
        const existingPengajuan = await tx.pengajuan.findUnique({ where: { slug: tokoSlug } });
        if (existingPengajuan) tokoSlug = `${tokoSlug}-${Date.now().toString(36)}`;

        await pengajuanRepository.insert(tx, {
          slug: tokoSlug,
          nama: input.toko,
          lokasiGang: input.lokasi,
          pengrajin: nama,
          keahlian: input.peran,
          nik: input.nik,
          fotoKtp: upload.pathname,
          whatsapp: input.whatsapp,
        });

        return { user: { id: userId, nama, username, email, status: "menunggu" as const }, ktpPath: upload.pathname };
      });
      return result.user;
    } catch (error) {
      // Dua pendaftaran bersamaan dengan data sama: UNIQUE index menjadi penjaga terakhir.
      if (isDuplicateEntry(error)) {
        const again = await userRepository.findTakenFields(prisma, { email, username, nik: input.nik });
        throw conflictError(again.size > 0 ? again : ["email"]);
      }
      throw error;
    }
  },

  /** Cari pengguna dari token sesi; null bila token tidak dikenal/kedaluwarsa. */
  async resolveSession(token: string): Promise<AuthenticatedUser | null> {
    const user = await userRepository.findBySessionHash(hashToken(token), new Date());
    return user ? toPublicUser(user) : null;
  },

  async publicUser(token: string): Promise<AdminUser | null> {
    const user = await this.resolveSession(token);
    if (!user) return null;
    const { akunId: _akunId, ...publicProfile } = user;
    return publicProfile;
  },

  logout(token: string) {
    return sessionStore.revoke(token);
  },
};

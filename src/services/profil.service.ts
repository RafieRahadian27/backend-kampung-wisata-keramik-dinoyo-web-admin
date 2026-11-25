import { hashPassword, verifyPassword } from "../auth/password";
import { hashToken, sessionStore } from "../auth/sessionStore";
import { prisma, withTransaction } from "../lib/prisma";
import { validatePassword } from "../lib/validatePassword";
import { auditRepository } from "../repositories/audit.repository";
import { peranFromDb } from "../repositories/akun.repository";
import { produkRepository } from "../repositories/produk.repository";
import { userRepository } from "../repositories/user.repository";
import type { AdminUser } from "../types";
import { toAktivitas } from "../utils/aktivitas";
import { HttpError } from "../utils/httpError";

/** NIK hanya ditampilkan sebagian: 3507•••••••••0012. */
const samarkanNik = (nik: string) => `${nik.slice(0, 4)}${"•".repeat(Math.max(nik.length - 8, 0))}${nik.slice(-4)}`;

/** Ringkas user-agent menjadi "Chrome · Windows" untuk daftar sesi. */
function labelPerangkat(userAgent: string | null) {
  if (!userAgent) return "Perangkat tidak dikenal";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Firefox\//.test(userAgent)
          ? "Firefox"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : /node|undici|curl|postman/i.test(userAgent)
              ? "Server/Skrip"
              : "Browser lain";
  const os = /Windows/.test(userAgent)
    ? "Windows"
    : /Android/.test(userAgent)
      ? "Android"
      : /iPhone|iPad/.test(userAgent)
        ? "iOS"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}

export const profilService = {
  /** Profil + sesi aktif milik pengguna sendiri. Hash kata sandi tidak pernah ikut. */
  async detail(user: AdminUser, currentToken: string) {
    const now = new Date();
    const [profil, sesi, aktivitas, passwordTerakhir, totalAktivitas, produk] = await Promise.all([
      userRepository.findProfil(user.id),
      userRepository.listSessions(user.id, now),
      auditRepository.recentFor(prisma, user.id, [], 12),
      auditRepository.lastByUser(prisma, user.id, "akun:password"),
      auditRepository.countByUser(prisma, user.id),
      produkRepository.ringkasan(prisma, user),
    ]);
    if (!profil) throw new HttpError(404, "Pengguna tidak ditemukan");
    const currentHash = hashToken(currentToken);

    // Skor keamanan sederhana dari data yang benar-benar tercatat (bukan klaim).
    const HARI_MS = 24 * 60 * 60 * 1000;
    const sandiSegar = passwordTerakhir !== null && now.getTime() - passwordTerakhir.getTime() <= 180 * HARI_MS;
    const pemeriksaan = [
      {
        label: "Kata sandi diganti dalam 180 hari terakhir",
        ok: sandiSegar,
        saran: passwordTerakhir ? "Sudah lebih dari 180 hari — ganti kata sandi Anda." : "Belum pernah diganti sejak akun dibuat.",
      },
      { label: "Maksimal 2 perangkat aktif", ok: sesi.length <= 2, saran: `${sesi.length} perangkat sedang login — keluarkan yang tidak dikenal.` },
      {
        label: "Akun terverifikasi paguyuban",
        ok: !profil.akun || profil.akun.status === "aktif",
        saran: "Akun belum aktif penuh — hubungi admin paguyuban.",
      },
      { label: "Riwayat login tercatat", ok: profil.lastLoginAt !== null, saran: "Login terakhir belum tercatat." },
    ];

    return {
      nama: profil.nama,
      sapaan: profil.sapaan,
      email: profil.email,
      username: profil.username,
      peran: user.peran,
      role: user.role,
      terakhirLogin: profil.lastLoginAt?.toISOString() ?? null,
      akun: profil.akun
        ? {
            nik: samarkanNik(profil.akun.nik),
            whatsapp: profil.akun.whatsapp,
            toko: profil.akun.toko,
            lokasi: profil.akun.lokasi,
            peran: peranFromDb(profil.akun.peran),
            status: profil.akun.status,
          }
        : null,
      toko: profil.toko,
      statistik: { jumlahToko: profil.toko.length, jumlahProduk: produk.totalKoleksi, totalAktivitas, jumlahSesi: sesi.length },
      keamanan: {
        skor: Math.round((pemeriksaan.filter((item) => item.ok).length / pemeriksaan.length) * 100),
        passwordTerakhir: passwordTerakhir?.toISOString() ?? null,
        pemeriksaan,
      },
      aktivitas: aktivitas.map(toAktivitas),
      sesi: sesi.map((item) => ({
        id: item.tokenHash.slice(0, 12),
        perangkat: labelPerangkat(item.userAgent),
        ipAddress: item.ipAddress,
        dibuat: item.createdAt.toISOString(),
        berakhir: item.expiresAt.toISOString(),
        sesiIni: item.tokenHash === currentHash,
      })),
    };
  },

  /**
   * Ganti kata sandi: verifikasi sandi lama → cek kekuatan sandi baru → simpan hash baru,
   * cabut semua sesi LAIN (perangkat yang mungkin sudah tidak dipercaya), catat audit.
   */
  async gantiPassword(user: AdminUser, currentToken: string, input: { passwordLama: string; passwordBaru: string }) {
    const kredensial = await userRepository.findPasswordContext(user.id);
    if (!kredensial) throw new HttpError(404, "Pengguna tidak ditemukan");

    if (!(await verifyPassword(input.passwordLama, kredensial.passwordHash))) {
      throw new HttpError(422, "Kata sandi saat ini salah", { details: [{ field: "passwordLama", message: "Kata sandi saat ini salah" }] });
    }
    const lemah = validatePassword(input.passwordBaru, { username: kredensial.username, email: kredensial.email });
    if (lemah) throw new HttpError(422, lemah, { details: [{ field: "passwordBaru", message: lemah }] });

    const passwordHash = await hashPassword(input.passwordBaru);
    const dicabut = await withTransaction(async (tx) => {
      await userRepository.updatePassword(tx, user.id, passwordHash);
      const jumlah = await sessionStore.revokeOthers(tx, user.id, hashToken(currentToken));
      await auditRepository.insert(tx, { userId: user.id, aksi: "akun:password", target: user.email, detail: `${jumlah} sesi lain dicabut` });
      return jumlah;
    });
    return { sesiDicabut: dicabut };
  },

  /** Ubah nama tampilan (sapaan) yang muncul di sapaan dashboard & sidebar. */
  async ubahSapaan(user: AdminUser, sapaan: string) {
    const bersih = sapaan.replace(/\s+/g, " ").trim();
    await withTransaction(async (tx) => {
      await userRepository.updateSapaan(tx, user.id, bersih);
      await auditRepository.insert(tx, { userId: user.id, aksi: "akun:profil", target: user.email, detail: `Nama tampilan: ${bersih}`.slice(0, 255) });
    });
    return { sapaan: bersih };
  },

  /** Keluar dari semua perangkat lain; sesi yang sedang dipakai tetap aktif. */
  async cabutSesiLain(user: AdminUser, currentToken: string) {
    const jumlah = await withTransaction(async (tx) => {
      const count = await sessionStore.revokeOthers(tx, user.id, hashToken(currentToken));
      await auditRepository.insert(tx, { userId: user.id, aksi: "akun:sesi", target: user.email, detail: `${count} sesi lain dicabut` });
      return count;
    });
    return { sesiDicabut: jumlah };
  },
};

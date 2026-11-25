import { sessionStore } from "../auth/sessionStore";
import type { Prisma } from "../generated/prisma/client";
import { prisma, withTransaction } from "../lib/prisma";
import { type AkunFilter, akunRepository } from "../repositories/akun.repository";
import { auditRepository } from "../repositories/audit.repository";
import { tokoRepository } from "../repositories/toko.repository";
import { userRepository } from "../repositories/user.repository";
import type { Akun, AdminUser, StatusAkun } from "../types";
import { HttpError } from "../utils/httpError";
import { slugify } from "../utils/slugify";
import { DEFAULT_TOKO } from "./toko.service";

export type { AkunFilter };

/** Hasil penautan toko otomatis saat akun diaktifkan — dikirim ke admin sebagai keterangan. */
export type TokoOtomatis =
  | { aksi: "dibuat" | "dihubungkan"; slug: string; nama: string }
  | { aksi: "sudah-terhubung" }
  | { aksi: "dilewati"; alasan: string };

function awalHariIni() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Hubungkan akun pengrajin ke toko yang ditulisnya saat mendaftar (`akun.toko`), agar setelah
 * login ia langsung bisa mengelola tokonya. Dijalankan di dalam transaksi aktivasi akun.
 *
 *  - toko belum ada                         → dibuat (status "menunggu", belum tampil publik) lalu dihubungkan
 *  - toko ada & belum punya pemilik          → dihubungkan
 *  - toko ada & sudah dimiliki orang lain    → Staf Pengrajin dihubungkan (bergabung ke toko itu);
 *                                              Pemilik Toko TIDAK dihubungkan, agar toko orang lain
 *                                              tidak bisa diklaim hanya dengan mengetik namanya
 */
async function hubungkanToko(tx: Prisma.TransactionClient, admin: AdminUser, akun: Akun): Promise<TokoOtomatis> {
  const users = await userRepository.findByAkunId(tx, akun.id);
  if (users.length === 0) return { aksi: "dilewati", alasan: "akun ini belum memiliki login" };
  const tanpaToko = users.filter((user) => user.jumlahToko === 0).map((user) => user.id);
  if (tanpaToko.length === 0) return { aksi: "sudah-terhubung" };

  const nama = akun.toko.trim().slice(0, 60);
  const slug = slugify(nama);
  if (!slug) return { aksi: "dilewati", alasan: `nama toko "${akun.toko}" tidak valid` };

  const ada = await tokoRepository.findKepemilikan(tx, slug);
  let hasil: TokoOtomatis;
  if (!ada) {
    const tokoId = await tokoRepository.insert(tx, slug, {
      ...DEFAULT_TOKO,
      nama,
      pemilik: akun.nama,
      whatsapp: akun.whatsapp,
      lokasiGang: akun.lokasi.slice(0, 60),
      alamat: akun.lokasi,
      wilayah: "Kampung Wisata Keramik Dinoyo, Kota Malang",
      tahunBerdiri: new Date().getFullYear(),
      jamBuka: "-",
      keterangan: "Dibuat otomatis dari pendaftaran akun",
    });
    await tokoRepository.addPemilik(tx, tokoId, tanpaToko);
    hasil = { aksi: "dibuat", slug, nama };
  } else if (ada.jumlahPemilik === 0 || akun.peran === "Staf Pengrajin") {
    await tokoRepository.addPemilik(tx, ada.id, tanpaToko);
    hasil = { aksi: "dihubungkan", slug: ada.slug, nama: ada.nama };
  } else {
    return { aksi: "dilewati", alasan: `toko "${ada.nama}" sudah dimiliki pengguna lain` };
  }

  await auditRepository.insert(tx, { userId: admin.id, aksi: `toko:otomatis-${hasil.aksi}`, target: slug, detail: akun.nama });
  return hasil;
}

export const akunService = {
  findAll(filter: AkunFilter = {}): Promise<Akun[]> {
    return akunRepository.findMany(prisma, filter);
  },

  ringkasan() {
    return akunRepository.ringkasan(prisma, awalHariIni());
  },

  /**
   * Transaksi: ubah status + (aktif) hubungkan toko / (tidak aktif) cabut semua sesi + catat audit.
   * Tanpa transaksi, kegagalan di tengah bisa meninggalkan akun "ditangguhkan" yang
   * sesinya masih hidup, atau akun aktif yang tokonya setengah dibuat.
   */
  async updateStatus(user: AdminUser, id: number, status: StatusAkun) {
    return withTransaction(async (tx) => {
      const akun = await akunRepository.findById(tx, id, { forUpdate: true });
      if (!akun) throw new HttpError(404, "Akun tidak ditemukan");

      await akunRepository.updateStatus(tx, id, status);
      const sesiDicabut = status === "aktif" ? 0 : await sessionStore.revokeByAkun(tx, id);
      const toko = status === "aktif" ? await hubungkanToko(tx, user, akun) : undefined;
      await auditRepository.insert(tx, {
        userId: user.id,
        aksi: "akun:status",
        target: akun.nama,
        detail: `${akun.status} → ${status}; ${sesiDicabut} sesi dicabut`,
      });
      return { akun: { ...akun, status }, sesiDicabut, toko };
    });
  },
};

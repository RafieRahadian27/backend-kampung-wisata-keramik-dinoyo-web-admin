import { isDuplicateEntry, lockRow, prisma, withTransaction } from "../lib/prisma";
import { storage } from "../lib/storage";
import { auditRepository } from "../repositories/audit.repository";
import { pengajuanRepository } from "../repositories/pengajuan.repository";
import { tokoRepository } from "../repositories/toko.repository";
import { BATAS_PENGAJUAN_JAM, isPengajuanKedaluwarsa, toPengajuan } from "../models";
import type { AdminUser, Pengajuan, TokoInput } from "../types";
import { HttpError } from "../utils/httpError";

export type Keputusan = "verifikasi" | "tolak";

/** Data awal toko yang lahir dari pengajuan yang disetujui. */
function tokoDariPengajuan(p: Pengajuan, fotoKtp?: string | null): TokoInput {
  return {
    nama: p.nama,
    nib: "-",
    keterangan: "Diverifikasi dari pengajuan",
    pemilik: p.pengrajin,
    nik: p.nik,
    fotoKtp,
    whatsapp: p.whatsapp || "-",
    lokasiGang: p.lokasiGang,
    wilayah: p.lokasiGang,
    alamat: "",
    koordinat: "",
    spesialisasi: p.keahlian,
    kategori: [],
    jumlahProduk: 0,
    tahunBerdiri: new Date().getFullYear(),
    deskripsi: `Keahlian: ${p.keahlian}.`,
    jamBuka: "08:00 - 16:00 WIB",
    status: "terverifikasi",
    badge: "baru",
    foto: p.foto,
    aktifPublik: true,
    akreditasi: true,
  };
}

const pengajuanKedaluwarsa = () =>
  new HttpError(409, `Pengajuan sudah melewati batas verifikasi ${BATAS_PENGAJUAN_JAM} jam dan dinonaktifkan. Pengrajin perlu mengajukan ulang.`, {
    code: "PENGAJUAN_KEDALUWARSA",
  });

export const pengajuanService = {
  async requestCorrection(user: AdminUser, slug: string, alasan: string) {
    await withTransaction(async (tx) => {
      const existing = await tx.pengajuan.findUnique({ where: { slug }, select: { id: true, nik: true } });
      if (!existing || !(await lockRow(tx, "pengajuan", existing.id))) throw new HttpError(404, "Pengajuan tidak ditemukan");
      const row = await tx.pengajuan.findUnique({ where: { id: existing.id }, select: { nik: true, status: true } });
      if (!row) throw new HttpError(404, "Pengajuan tidak ditemukan");
      if (!row.nik) throw new HttpError(409, "Pengajuan tidak memiliki pemilik yang terverifikasi");
      const owners = await tx.user.findMany({ where: { akun: { nik: row.nik } }, select: { id: true }, take: 2 });
      if (owners.length !== 1) throw new HttpError(409, "Pemilik pengajuan tidak dapat diverifikasi");
      if (row.status !== "menunggu") throw new HttpError(409, "Pengajuan tidak lagi menunggu verifikasi");
      await tx.pengajuan.update({ where: { id: existing.id }, data: { koreksiAlasan: alasan.trim() } });
      await auditRepository.insert(tx, { userId: user.id, aksi: "pengajuan:koreksi", target: slug });
    });
    return { slug, koreksiAlasan: alasan.trim() };
  },

  async assertCanReplaceKtp(user: AdminUser, slug: string) {
    if (user.role !== "pengrajin") throw new HttpError(403, "Akses ditolak");
    const linkedUser = await prisma.user.findUnique({ where: { id: user.id }, select: { akunId: true } });
    if (!linkedUser?.akunId) throw new HttpError(403, "Akses ditolak");
    const account = await prisma.akun.findUnique({ where: { id: linkedUser.akunId }, select: { nik: true } });
    if (!account) throw new HttpError(403, "Akses ditolak");
    const ownerCount = await prisma.user.count({ where: { akun: { nik: account.nik } } });
    if (ownerCount !== 1) throw new HttpError(403, "Akses ditolak");
    const row = await prisma.pengajuan.findFirst({ where: { slug, nik: account.nik, status: "menunggu", koreksiAlasan: { not: null } }, select: { id: true } });
    if (!row) throw new HttpError(404, "Pengajuan koreksi tidak ditemukan");
    return account.nik;
  },

  async replaceKtp(user: AdminUser, slug: string, fotoKtp: string) {
    const oldPath = await withTransaction(async (tx) => {
      if (user.role !== "pengrajin") throw new HttpError(403, "Akses ditolak");
      const linkedUser = await tx.user.findUnique({ where: { id: user.id }, select: { akunId: true } });
      if (!linkedUser?.akunId) throw new HttpError(403, "Akses ditolak");
      const account = await tx.akun.findUnique({ where: { id: linkedUser.akunId }, select: { nik: true } });
      if (!account) throw new HttpError(403, "Akses ditolak");
      const owners = await tx.user.findMany({ where: { akun: { nik: account.nik } }, select: { id: true }, take: 2 });
      if (owners.length !== 1 || owners[0].id !== user.id) throw new HttpError(403, "Akses ditolak");
      const nik = account.nik;
      const existing = await tx.pengajuan.findFirst({ where: { slug, nik, status: "menunggu", koreksiAlasan: { not: null } }, select: { id: true } });
      if (!existing || !(await lockRow(tx, "pengajuan", existing.id))) throw new HttpError(404, "Pengajuan koreksi tidak ditemukan");
      const row = await tx.pengajuan.findUnique({ where: { id: existing.id }, select: { fotoKtp: true, koreksiAlasan: true, status: true } });
      if (!row || row.status !== "menunggu" || row.koreksiAlasan === null) throw new HttpError(404, "Pengajuan koreksi tidak ditemukan");
      await tx.pengajuan.update({ where: { id: existing.id }, data: { fotoKtp, koreksiAlasan: null, diajukanPada: new Date(), status: "menunggu" } });
      await auditRepository.insert(tx, { userId: user.id, aksi: "pengajuan:ktp-diganti", target: slug });
      return row.fotoKtp;
    });
    if (oldPath && oldPath !== fotoKtp) await storage.removePrivate(oldPath);
    return { slug, status: "menunggu" as const };
  },
  /** Tandai yang lewat batas lebih dulu, baru baca antrean — status yang dikirim selalu terkini. */
  async findAll(): Promise<Pengajuan[]> {
    await pengajuanRepository.expireOverdue(prisma);
    return pengajuanRepository.findAll(prisma);
  },

  /**
   * Skenario multi-langkah dalam SATU transaksi:
   *   1. kunci baris pengajuan (FOR UPDATE) — dua admin tidak bisa memutuskan bersamaan
   *   2. cek batas waktu: pengajuan kedaluwarsa TIDAK boleh diverifikasi (hanya boleh ditolak/dibersihkan)
   *   3. verifikasi → UPDATE toko yang sudah ada (dibuat otomatis saat aktivasi) atau INSERT toko baru ke direktori
   *   4. DELETE pengajuan
   *   5. INSERT audit log
   * Jika langkah 3 gagal (mis. nama toko sudah ada), langkah 4 & 5 ikut di-ROLLBACK:
   * pengajuan tidak hilang tanpa tokonya tercatat.
   */
  async putuskan(user: AdminUser, slug: string, keputusan: Keputusan) {
    try {
      const hasil = await withTransaction(async (tx) => {
        const pengajuan = await pengajuanRepository.lockBySlug(tx, slug);
        if (!pengajuan) throw new HttpError(404, "Pengajuan tidak ditemukan");
        const { id, ...row } = pengajuan;
        const data = toPengajuan(row);

        if (keputusan === "verifikasi" && isPengajuanKedaluwarsa(row)) {
          // Status kedaluwarsa disimpan (transaksi di-commit), error dilempar SETELAH transaksi selesai.
          if (row.status !== "kedaluwarsa") await pengajuanRepository.markKedaluwarsa(tx, id);
          return { kedaluwarsa: true as const };
        }

        if (keputusan === "verifikasi") {
          // Toko bisa sudah ada karena dibuat otomatis saat aktivasi akun (status "menunggu").
          // Verifikasi harus mengaktifkannya, bukan INSERT baru yang memicu 409 duplikat.
          const existing = await tx.toko.findFirst({
            where: { OR: [{ slug }, { nama: data.nama }] },
            select: { id: true },
          });
          let newTokoId: number;
          if (existing) {
            await tx.toko.update({ where: { id: existing.id }, data: { status: "terverifikasi", aktifPublik: true } });
            newTokoId = existing.id;
          } else {
            newTokoId = await tokoRepository.insert(tx, slug, tokoDariPengajuan(data, row.fotoKtp));
          }

          // ponytail: sinkronkan aktivasi akun pengrajin saat tokonya diverifikasi
          if (data.nik) {
            const akun = await tx.akun.findFirst({ where: { nik: data.nik } });
            if (akun) {
              await tx.akun.update({ where: { id: akun.id }, data: { status: "aktif" } });
              const userRow = await tx.user.findFirst({ where: { akunId: akun.id } });
              if (userRow) {
                await tx.userToko.upsert({
                  where: { userId_tokoId: { userId: userRow.id, tokoId: newTokoId } },
                  create: { userId: userRow.id, tokoId: newTokoId },
                  update: {},
                });
              }
            }
          }
        }
        await pengajuanRepository.remove(tx, id);
        await auditRepository.insert(tx, { userId: user.id, aksi: `pengajuan:${keputusan}`, target: data.nama });
        return { ...data, keputusan };
      });
      if ("kedaluwarsa" in hasil) throw pengajuanKedaluwarsa();
      return hasil;
    } catch (error) {
      if (isDuplicateEntry(error)) throw new HttpError(409, "Toko dengan nama ini sudah ada di direktori. Pengajuan tidak diproses.");
      throw error;
    }
  },
};

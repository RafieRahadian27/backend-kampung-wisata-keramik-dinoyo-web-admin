import type { Prisma } from "../generated/prisma/client";
import { type Db, lockRow } from "../lib/prisma";
import { BATAS_PENGAJUAN_MS, type Pengajuan, type PengajuanRow, toPengajuan } from "../models";

const PENGAJUAN_SELECT = {
  slug: true,
  nama: true,
  lokasiGang: true,
  pengrajin: true,
  keahlian: true,
  nik: true,
  fotoKtp: true,
  whatsapp: true,
  foto: true,
  diajukanPada: true,
  status: true,
  koreksiAlasan: true,
} satisfies Prisma.PengajuanSelect;

export const pengajuanRepository = {
  async insert(db: Db, data: { slug: string; nama: string; lokasiGang: string; pengrajin: string; keahlian: string; nik?: string; fotoKtp?: string; whatsapp?: string; foto?: string }) {
    return await db.pengajuan.create({
      data: {
        slug: data.slug,
        nama: data.nama,
        lokasiGang: data.lokasiGang,
        pengrajin: data.pengrajin,
        keahlian: data.keahlian,
        nik: data.nik,
        fotoKtp: data.fotoKtp,
        whatsapp: data.whatsapp,
        foto: data.foto || "/images/sampul-galeri.jpg",
        diajukan: "Baru saja diajukan",
        status: "menunggu",
      },
    });
  },
  /**
   * Tandai `kedaluwarsa` semua pengajuan yang lewat batas 3×24 jam (lazy expiry).
   * Dipanggil sebelum antrean dibaca, sehingga status di database selalu sesuai tanpa cron job.
   * Index `idx_pengajuan_status (status, diajukan_pada)` membuat UPDATE ini tidak memindai seluruh tabel.
   */
  async expireOverdue(db: Db, now = new Date()): Promise<number> {
    const { count } = await db.pengajuan.updateMany({
      where: { status: "menunggu", diajukanPada: { lte: new Date(now.getTime() - BATAS_PENGAJUAN_MS) } },
      data: { status: "kedaluwarsa" },
    });
    return count;
  },

  /** Yang masih menunggu didahulukan (paling mendesak = paling lama diajukan), lalu yang kedaluwarsa. */
  async findAll(db: Db, now = new Date()): Promise<Pengajuan[]> {
    const rows: PengajuanRow[] = await db.pengajuan.findMany({ select: PENGAJUAN_SELECT, orderBy: [{ status: "asc" }, { diajukanPada: "asc" }] });
    return rows.map((row) => toPengajuan(row, now));
  },

  async lockBySlug(tx: Prisma.TransactionClient, slug: string) {
    const row = await tx.pengajuan.findUnique({ where: { slug }, select: { id: true } });
    if (!row || !(await lockRow(tx, "pengajuan", row.id))) return undefined;
    // Dibaca ulang setelah terkunci agar isinya pasti versi terbaru.
    const pengajuan = await tx.pengajuan.findUnique({ where: { id: row.id }, select: { id: true, ...PENGAJUAN_SELECT } });
    return pengajuan ?? undefined;
  },

  async markKedaluwarsa(db: Db, id: number) {
    await db.pengajuan.update({ where: { id }, data: { status: "kedaluwarsa" } });
  },

  async requestCorrection(db: Db, slug: string, nik: string, alasan: string) {
    const row = await db.pengajuan.findFirst({ where: { slug, nik, status: "menunggu" }, select: { id: true } });
    if (!row) return false;
    await db.pengajuan.update({ where: { id: row.id }, data: { koreksiAlasan: alasan } });
    return true;
  },

  async replaceKtp(db: Db, slug: string, nik: string, fotoKtp: string, now = new Date()) {
    const row = await db.pengajuan.findFirst({ where: { slug, nik, status: "menunggu", koreksiAlasan: { not: null } }, select: { id: true } });
    if (!row) return false;
    await db.pengajuan.update({ where: { id: row.id }, data: { fotoKtp, koreksiAlasan: null, diajukanPada: now, status: "menunggu" } });
    return true;
  },

  async remove(db: Db, id: number) {
    await db.pengajuan.delete({ where: { id } });
  },
};

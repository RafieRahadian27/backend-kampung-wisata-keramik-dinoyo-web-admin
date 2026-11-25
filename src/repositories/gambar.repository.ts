import type { Db } from "../lib/prisma";
import type { Gambar, GambarInput } from "../models";

const GAMBAR_SELECT = {
  id: true,
  url: true,
  pathname: true,
  contentType: true,
  ukuran: true,
  jenis: true,
  tokoId: true,
  produkId: true,
  diunggahOleh: true,
  dibuat: true,
} as const;

/** Query tabel `gambar` — catatan metadata berkas Vercel Blob (lihat models/gambar.model.ts). */
export const gambarRepository = {
  async insert(db: Db, input: GambarInput): Promise<number> {
    const row = await db.gambar.create({ data: input, select: { id: true } });
    return row.id;
  },

  /** Hapus catatan berkas yang sudah tidak dipakai (mis. foto lama yang baru saja diganti). */
  async removeByUrl(db: Db, url: string | null | undefined): Promise<void> {
    if (!url) return;
    await db.gambar.deleteMany({ where: { url } });
  },

  async findAll(db: Db): Promise<Gambar[]> {
    const rows = await db.gambar.findMany({ select: GAMBAR_SELECT, orderBy: { dibuat: "desc" }, take: 500 });
    return rows.map((row) => ({ ...row, dibuat: row.dibuat.toISOString() }));
  },

  /** Ringkasan pemakaian storage per jenis — dasar pemantauan kuota Vercel Blob. */
  async ringkasan(db: Db) {
    const rows = await db.gambar.groupBy({ by: ["jenis"], _count: { _all: true }, _sum: { ukuran: true } });
    return rows.map((row) => ({ jenis: row.jenis, jumlah: row._count._all, totalByte: row._sum.ukuran ?? 0 }));
  },
};

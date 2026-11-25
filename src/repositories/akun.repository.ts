import { type Akun as AkunRow, PeranAkun as PeranDb, type Prisma } from "../generated/prisma/client";
import { type Db, likeSafe, lockRow } from "../lib/prisma";
import type { Akun, PeranAkun, StatusAkun } from "../types";

/** Label peran di API/UI ↔ nilai enum Prisma (ENUM MySQL memakai spasi, lihat schema.prisma). */
const PERAN_TO_DB: Record<PeranAkun, PeranDb> = {
  "Pemilik Toko": PeranDb.PemilikToko,
  "Staf Pengrajin": PeranDb.StafPengrajin,
};
const PERAN_FROM_DB: Record<PeranDb, PeranAkun> = {
  [PeranDb.PemilikToko]: "Pemilik Toko",
  [PeranDb.StafPengrajin]: "Staf Pengrajin",
};

export const peranToDb = (peran: PeranAkun) => PERAN_TO_DB[peran];
export const peranFromDb = (peran: PeranDb) => PERAN_FROM_DB[peran];

const toAkun = ({ peran, tone, ...row }: AkunRow): Akun => ({ ...row, peran: PERAN_FROM_DB[peran], tone: tone as Akun["tone"] });

export interface AkunFilter {
  q?: string;
  peran?: PeranAkun;
  status?: StatusAkun;
}

export const akunRepository = {
  async findMany(db: Db, filter: AkunFilter = {}): Promise<Akun[]> {
    const q = filter.q && likeSafe(filter.q);
    const where: Prisma.AkunWhereInput = {
      ...(q ? { OR: [{ nama: { contains: q } }, { email: { contains: q } }, { nik: { contains: q } }] } : {}),
      ...(filter.peran ? { peran: peranToDb(filter.peran) } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    };
    const rows = await db.akun.findMany({ where, orderBy: { id: "asc" } });
    return rows.map(toAkun);
  },

  /** `forUpdate` hanya bermakna di dalam transaksi: baris dikunci sampai COMMIT. */
  async findById(db: Prisma.TransactionClient, id: number, { forUpdate = false } = {}): Promise<Akun | undefined> {
    if (forUpdate && !(await lockRow(db, "akun", id))) return undefined;
    const row = await db.akun.findUnique({ where: { id } });
    return row ? toAkun(row) : undefined;
  },

  /** Akun hasil pendaftaran mandiri selalu berstatus "menunggu" sampai diaktifkan admin. */
  async insert(db: Db, akun: Pick<Akun, "nama" | "inisial" | "nik" | "email" | "toko" | "lokasi" | "peran" | "whatsapp"> & { umur: number; fotoKtp?: string }) {
    const row = await db.akun.create({ data: { ...akun, peran: peranToDb(akun.peran), status: "menunggu" }, select: { id: true } });
    return row.id;
  },

  async updateStatus(db: Db, id: number, status: StatusAkun) {
    await db.akun.update({ where: { id }, data: { status } });
  },

  async touchTerakhirAktif(db: Db, id: number, label: string) {
    await db.akun.update({ where: { id }, data: { terakhirAktif: label } });
  },

  /** Beberapa agregat independen dikirim bersamaan (Promise.all) → total waktu ≈ query paling lambat. */
  async ringkasan(db: Db, sesiSejak: Date) {
    const [total, aktif, menunggu, sesiHariIni, tokoAktif] = await Promise.all([
      db.akun.count(),
      db.akun.count({ where: { status: "aktif" } }),
      db.akun.count({ where: { status: "menunggu" } }),
      db.session.count({ where: { createdAt: { gte: sesiSejak } } }),
      db.toko.count({ where: { status: "terverifikasi", aktifPublik: true } }),
    ]);
    return {
      total,
      aktif,
      menunggu,
      sesiHariIni,
      tokoAktif,
      persenAktifPekan: total === 0 ? 0 : Math.round((aktif / total) * 100),
    };
  },
};

import { tokoScope } from "../auth/policy";
import type { Prisma } from "../generated/prisma/client";
import { type Db, likeSafe, lockRow } from "../lib/prisma";
import type { AdminUser, Produk } from "../types";

const PRODUK_INCLUDE = { toko: { select: { slug: true } } } satisfies Prisma.ProdukInclude;
type ProdukRow = Prisma.ProdukGetPayload<{ include: typeof PRODUK_INCLUDE }>;

/** Transformasi field: kolom datar toko_* dikelompokkan kembali menjadi objek `toko`. */
function toProduk(row: ProdukRow): Produk {
  return {
    id: row.id,
    nama: row.nama,
    sku: row.sku,
    tokoSlug: row.toko.slug,
    teknik: row.teknik,
    foto: row.foto,
    ...(row.badge ? { badge: row.badge } : {}),
    toko: { nama: row.tokoLabel, inisial: row.tokoInisial, pengrajin: row.pengrajin },
    kategori: row.kategori,
    bahan: row.bahan,
    harga: row.harga,
    catatanHarga: row.catatanHarga,
    status: row.status,
    stokLabel: row.stokLabel,
    lokasiStok: row.lokasiStok,
    aktifPublik: row.aktifPublik,
  };
}

export interface ProdukFilter {
  q?: string;
  kategori?: string;
  /** Nama toko seperti yang tampil di filter UI. */
  toko?: string;
  tokoSlug?: string;
}

/** Produk terlihat bila tokonya termasuk cakupan pengguna (ABAC). */
const scoped = (user: AdminUser): Prisma.ProdukWhereInput => ({ toko: tokoScope(user) });

export const produkRepository = {
  async findMany(db: Db, user: AdminUser, filter: ProdukFilter = {}): Promise<Produk[]> {
    const q = filter.q && likeSafe(filter.q);
    const where: Prisma.ProdukWhereInput = {
      AND: [
        scoped(user),
        q ? { OR: [{ nama: { contains: q } }, { sku: { contains: q } }] } : {},
        filter.kategori ? { kategori: filter.kategori } : {},
        filter.toko ? { tokoLabel: filter.toko } : {},
        filter.tokoSlug ? { toko: { slug: filter.tokoSlug } } : {},
      ],
    };
    const rows = await db.produk.findMany({ where, include: PRODUK_INCLUDE, orderBy: { id: "asc" } });
    return rows.map(toProduk);
  },

  /** Semua kategori master beserta jumlah produk yang terlihat oleh pengguna (0 bila kosong). */
  async kategori(db: Db, user: AdminUser) {
    const rows = await db.kategoriProduk.findMany({
      orderBy: { urutan: "asc" },
      select: { nama: true, _count: { select: { produk: { where: scoped(user) } } } },
    });
    return rows.map((row) => ({ nama: row.nama, jumlah: row._count.produk }));
  },

  async ringkasan(db: Db, user: AdminUser) {
    const where = scoped(user);
    const [totalKoleksi, perToko, stokTersedia, preOrder, habis] = await Promise.all([
      db.produk.count({ where }),
      db.produk.groupBy({ by: ["tokoId"], where }),
      db.produk.count({ where: { ...where, status: "tersedia" } }),
      db.produk.count({ where: { ...where, status: "preorder" } }),
      db.produk.count({ where: { ...where, status: "habis" } }),
    ]);
    return { totalKoleksi, pengrajin: perToko.length, stokTersedia, preOrder, habis, suhuBakar: "1.240°C" };
  },

  async findById(db: Db, user: AdminUser, id: number): Promise<Produk | undefined> {
    const row = await db.produk.findFirst({ where: { id, ...scoped(user) }, include: PRODUK_INCLUDE });
    return row ? toProduk(row) : undefined;
  },

  /** Produk terbaru (ID terbesar) dalam cakupan pengguna — dipakai Dashboard Toko. */
  async latest(db: Db, user: AdminUser, take = 5): Promise<Produk[]> {
    const rows = await db.produk.findMany({ where: scoped(user), include: PRODUK_INCLUDE, orderBy: { id: "desc" }, take });
    return rows.map(toProduk);
  },

  /**
   * Statistik harga per kategori dari SELURUH sentra (agregat, tanpa data per toko) — acuan
   * harga saat menambah produk. Sengaja tidak memakai ABAC karena hanya angka ringkasan pasar.
   */
  async hargaPasar(db: Db) {
    const rows = await db.produk.groupBy({ by: ["kategori"], _count: { _all: true }, _min: { harga: true }, _max: { harga: true }, _avg: { harga: true } });
    return rows.map((row) => ({
      kategori: row.kategori,
      jumlah: row._count._all,
      termurah: row._min.harga ?? 0,
      termahal: row._max.harga ?? 0,
      rataRata: Math.round(row._avg.harga ?? 0),
    }));
  },

  async kategoriExists(db: Db, nama: string) {
    return (await db.kategoriProduk.count({ where: { nama } })) > 0;
  },

  /** SKU sementara harus unik; `insert` lalu `setSku` mengganti dengan SKU final berbasis ID. */
  async insert(db: Db, data: Omit<Prisma.ProdukUncheckedCreateInput, "id">) {
    const row = await db.produk.create({ data, select: { id: true } });
    return row.id;
  },

  async setSku(db: Db, id: number, sku: string) {
    await db.produk.update({ where: { id }, data: { sku } });
  },

  async setFoto(db: Db, id: number, foto: string) {
    await db.produk.update({ where: { id }, data: { foto } });
  },

  async update(db: Db, id: number, data: Prisma.ProdukUncheckedUpdateInput) {
    return db.produk.update({ where: { id }, data });
  },

  async setPublic(db: Db, user: AdminUser, id: number, aktifPublik: boolean) {
    return db.produk.updateMany({ where: { id, ...scoped(user) }, data: { aktifPublik } });
  },

  async lockById(tx: Prisma.TransactionClient, user: AdminUser, id: number) {
    const produk = await tx.produk.findFirst({ where: { id, ...scoped(user) }, select: { id: true, nama: true, tokoId: true, foto: true } });
    if (!produk || !(await lockRow(tx, "produk", produk.id))) return undefined;
    return produk;
  },

  async remove(db: Db, id: number) {
    await db.produk.delete({ where: { id } });
  },
};

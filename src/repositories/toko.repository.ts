import { tokoScope } from "../auth/policy";
import type { Prisma } from "../generated/prisma/client";
import { type Db, likeSafe, lockRow } from "../lib/prisma";
import type { AdminUser, Toko, TokoInput } from "../types";

const TOKO_INCLUDE = { kategori: { select: { kategori: true }, orderBy: { urutan: "asc" } } } satisfies Prisma.TokoInclude;
type TokoRow = Prisma.TokoGetPayload<{ include: typeof TOKO_INCLUDE }>;

/** Transformasi field: relasi kategori → array teks, badge/stempel NULL → tidak ada, DATETIME → ISO. */
function toToko({ kategori, badge, stempel, fotoKtp, diperbarui, ...row }: TokoRow): Toko {
  return {
    ...row,
    kategori: kategori.map((item) => item.kategori),
    ...(badge ? { badge } : {}),
    ...(stempel ? { stempel } : {}),
    ...(fotoKtp ? { hasFotoKtp: true } : {}),
    diperbarui: diperbarui.toISOString(),
  };
}

const kategoriRows = (kategori: string[]) => kategori.map((nama, urutan) => ({ kategori: nama, urutan }));

export interface TokoFilter {
  q?: string;
  status?: Toko["status"];
  lokasi?: string;
  kategori?: string;
  slug?: string;
}

export const tokoRepository = {
  async findFotoKtp(db: Db, slug: string): Promise<string | null> {
    const toko = await db.toko.findUnique({ where: { slug }, select: { fotoKtp: true } });
    return toko?.fotoKtp ?? null;
  },

  async findMany(db: Db, user: AdminUser, filter: TokoFilter = {}): Promise<Toko[]> {
    const q = filter.q && likeSafe(filter.q);
    const where: Prisma.TokoWhereInput = {
      AND: [
        tokoScope(user),
        q ? { OR: [{ nama: { contains: q } }, { pemilik: { contains: q } }, { nib: { contains: q } }] } : {},
        filter.status ? { status: filter.status } : {},
        filter.lokasi ? { lokasiGang: { startsWith: likeSafe(filter.lokasi) } } : {},
        filter.kategori ? { spesialisasi: filter.kategori } : {},
        filter.slug ? { slug: filter.slug } : {},
      ],
    };
    const rows = await db.toko.findMany({ where, include: TOKO_INCLUDE, orderBy: [{ diperbarui: "desc" }, { id: "asc" }] });
    return rows.map(toToko);
  },

  async findBySlug(db: Db, user: AdminUser, slug: string): Promise<Toko | undefined> {
    const [toko] = await this.findMany(db, user, { slug });
    return toko;
  },

  /** Cari toko dalam cakupan pengguna, lalu kunci barisnya agar tidak diubah transaksi lain sampai COMMIT. */
  async lockBySlug(tx: Prisma.TransactionClient, user: AdminUser, slug: string) {
    const toko = await tx.toko.findFirst({ where: { slug, ...tokoScope(user) }, select: { id: true, nama: true, foto: true, stempel: true } });
    if (!toko || !(await lockRow(tx, "toko", toko.id))) return undefined;
    return toko;
  },

  /** Data toko yang dibutuhkan untuk menyalin label pemilik ke baris produk baru. */
  async findLabelForProduk(db: Db, id: number) {
    return db.toko.findUnique({ where: { id }, select: { nama: true, pemilik: true } });
  },

  async ringkasan(db: Db, user: AdminUser) {
    // GROUP BY status → satu query menghasilkan jumlah per status sekaligus total produk.
    const groups = await db.toko.groupBy({ by: ["status"], where: tokoScope(user), _count: { _all: true }, _sum: { jumlahProduk: true } });
    const jumlah = (status: Toko["status"]) => groups.find((group) => group.status === status)?._count._all ?? 0;
    return {
      total: groups.reduce((sum, group) => sum + group._count._all, 0),
      terverifikasi: jumlah("terverifikasi"),
      menunggu: jumlah("menunggu"),
      nonaktif: jumlah("nonaktif"),
      katalogAktif: groups.reduce((sum, group) => sum + (group._sum.jumlahProduk ?? 0), 0),
    };
  },

  /** Toko + kategorinya dibuat dengan satu nested write. */
  async insert(db: Db, slug: string, { kategori, ...input }: TokoInput): Promise<number> {
    const row = await db.toko.create({
      data: { ...input, slug, diperbarui: new Date(), kategori: { create: kategoriRows(kategori) } },
      select: { id: true },
    });
    return row.id;
  },

  /** Field bernilai `undefined` diabaikan Prisma, jadi hanya kolom yang dikirim yang berubah. */
  async update(db: Db, id: number, { kategori, ...input }: Partial<TokoInput>) {
    await db.toko.update({
      where: { id },
      data: {
        ...input,
        diperbarui: new Date(),
        ...(kategori ? { kategori: { deleteMany: {}, create: kategoriRows(kategori) } } : {}),
      },
    });
  },

  /** Toko berdasarkan slug TANPA saringan ABAC — hanya untuk keputusan sistem, bukan untuk dikirim ke klien. */
  async findKepemilikan(db: Db, slug: string) {
    const toko = await db.toko.findUnique({
      where: { slug },
      select: { id: true, slug: true, nama: true, _count: { select: { pengguna: true } } },
    });
    return toko ? { id: toko.id, slug: toko.slug, nama: toko.nama, jumlahPemilik: toko._count.pengguna } : undefined;
  },

  /** Tambah relasi kepemilikan user ↔ toko (abaikan bila sudah ada). */
  async addPemilik(db: Db, tokoId: number, userIds: number[]) {
    await db.userToko.createMany({ data: userIds.map((userId) => ({ userId, tokoId })), skipDuplicates: true });
  },

  /** Prisma `decrement` bisa membuat kolom UNSIGNED negatif, jadi dijaga dengan GREATEST lewat raw query. */
  async adjustJumlahProduk(db: Db, tokoId: number, delta: number) {
    await db.$executeRaw`UPDATE toko SET jumlah_produk = GREATEST(CAST(jumlah_produk AS SIGNED) + ${delta}, 0) WHERE id = ${tokoId}`;
  },

  /** Produk, kategori, dan kepemilikan ikut terhapus lewat ON DELETE CASCADE. */
  async remove(db: Db, id: number) {
    await db.toko.delete({ where: { id } });
  },
};

import { akunSeed } from "../src/data/akun.data";
import { semuaProduk as produkSeed, semuaToko as tokoSeed } from "../src/data/katalog.data";
import { kategoriProduk } from "../src/data/produk.data";
import { pengajuanSeed } from "../src/data/toko.data";
import { userSeed } from "../src/data/user.data";
import { prisma } from "../src/lib/prisma";
import { peranToDb } from "../src/repositories/akun.repository";

/**
 * Seed data awal — dijalankan oleh `npm run db:seed`, dan di akhir `npm run db:reset`
 * (prisma migrate reset → prisma db seed). Struktur tabel dibuat oleh migrasi; file ini hanya mengisi baris.
 *
 * PERHATIAN: isi tabel aplikasi dihapus dulu agar seed bisa diulang (idempoten).
 * Semua langkah berada dalam satu transaksi: jika ada baris yang gagal, database tidak
 * dibiarkan terisi setengah.
 */
async function main() {
  const tokoIdBySlug = new Map(tokoSeed.map((t) => [t.slug, t.id]));
  const tokoId = (slug: string) => {
    const id = tokoIdBySlug.get(slug);
    if (id === undefined) throw new Error(`Seed merujuk toko "${slug}" yang tidak ada`);
    return id;
  };

  await prisma.$transaction(
    async (tx) => {
      // Urutan hapus mengikuti foreign key: tabel anak dulu, baru induknya.
      // Catatan gambar ikut dikosongkan; berkas di Vercel Blob tidak disentuh seed.
      await tx.gambar.deleteMany();
      await tx.auditLog.deleteMany();
      await tx.session.deleteMany();
      await tx.userToko.deleteMany();
      await tx.user.deleteMany();
      await tx.produk.deleteMany();
      await tx.kategoriProduk.deleteMany();
      await tx.tokoKategori.deleteMany();
      await tx.toko.deleteMany();
      await tx.pengajuan.deleteMany();
      await tx.akun.deleteMany();

      await tx.akun.createMany({
        data: akunSeed.map(({ terakhirAktif, peran, ...a }) => ({ ...a, peran: peranToDb(peran), terakhirAktif })),
      });

      await tx.toko.createMany({
        data: tokoSeed.map(({ kategori: _kategori, diperbarui, ...t }) => ({ ...t, diperbarui: new Date(diperbarui) })),
      });
      await tx.tokoKategori.createMany({
        data: tokoSeed.flatMap((t) => t.kategori.map((kategori, urutan) => ({ tokoId: t.id, kategori, urutan }))),
      });

      await tx.kategoriProduk.createMany({ data: kategoriProduk.map((k, urutan) => ({ nama: k.nama, urutan })) });
      await tx.produk.createMany({
        data: produkSeed.map(({ tokoSlug, toko, ...p }) => ({
          ...p,
          tokoId: tokoId(tokoSlug),
          tokoLabel: toko.nama,
          tokoInisial: toko.inisial,
          pengrajin: toko.pengrajin,
        })),
      });

      await tx.pengajuan.createMany({ data: pengajuanSeed });

      await tx.user.createMany({ data: userSeed.map(({ tokoSlugs: _tokoSlugs, ...u }) => u) });
      await tx.userToko.createMany({
        data: userSeed.flatMap((u) => u.tokoSlugs.map((slug) => ({ userId: u.id, tokoId: tokoId(slug) }))),
      });
    },
    // Seed berisi puluhan INSERT; batas waktu bawaan transaksi interaktif (5 detik) terlalu ketat.
    { timeout: 30_000 },
  );

  console.log(
    `✓ Data awal: ${akunSeed.length} akun, ${userSeed.length} pengguna, ${tokoSeed.length} toko, ` +
      `${produkSeed.length} produk, ${pengajuanSeed.length} pengajuan`,
  );
}

main()
  .catch((error) => {
    console.error("✗ Gagal mengisi data awal:", error instanceof Error ? error.message : error);
    console.error("  Pastikan MySQL (XAMPP) sudah berjalan dan migrasi sudah dijalankan (npm run db:deploy).");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

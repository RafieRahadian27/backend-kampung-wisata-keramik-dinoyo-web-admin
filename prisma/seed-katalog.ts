import { semuaProduk, semuaToko } from "../src/data/katalog.data";
import { prisma } from "../src/lib/prisma";

/**
 * `npm run db:katalog` — menambahkan toko & produk demo yang BELUM ada, tanpa menghapus apa pun.
 *
 * Berbeda dengan `db:seed` (mengosongkan tabel lalu mengisi ulang), skrip ini aman dijalankan pada
 * database yang sudah berisi data asli: toko dicocokkan lewat `slug`, produk lewat `sku`; yang sudah
 * ada dilewati. Di akhir, `jumlah_produk` setiap toko disamakan dengan jumlah produk sebenarnya.
 */
async function main() {
  const hasil = await prisma.$transaction(
    async (tx) => {
      const adaToko = new Set((await tx.toko.findMany({ select: { slug: true } })).map((t) => t.slug));
      const tokoBaru = semuaToko.filter((t) => !adaToko.has(t.slug));
      for (const { id: _id, kategori, diperbarui, ...toko } of tokoBaru) {
        const dibuat = await tx.toko.create({ data: { ...toko, diperbarui: new Date(diperbarui) }, select: { id: true } });
        if (kategori.length > 0) {
          await tx.tokoKategori.createMany({ data: kategori.map((nama, urutan) => ({ tokoId: dibuat.id, kategori: nama, urutan })) });
        }
      }

      const idToko = new Map((await tx.toko.findMany({ select: { id: true, slug: true } })).map((t) => [t.slug, t.id]));
      const adaSku = new Set((await tx.produk.findMany({ select: { sku: true } })).map((p) => p.sku));
      const produkBaru = semuaProduk.filter((p) => !adaSku.has(p.sku) && idToko.has(p.tokoSlug));
      if (produkBaru.length > 0) {
        await tx.produk.createMany({
          data: produkBaru.map(({ id: _id, tokoSlug, toko, ...p }) => ({
            ...p,
            tokoId: idToko.get(tokoSlug)!,
            tokoLabel: toko.nama,
            tokoInisial: toko.inisial,
            pengrajin: toko.pengrajin,
          })),
        });
      }

      // Angka "jumlah produk" di kartu toko = jumlah baris produk yang benar-benar ada.
      await tx.$executeRaw`UPDATE toko SET jumlah_produk = (SELECT COUNT(*) FROM produk WHERE produk.toko_id = toko.id)`;
      return { toko: tokoBaru.length, produk: produkBaru.length };
    },
    { timeout: 30_000 },
  );

  const [totalToko, totalProduk] = await Promise.all([prisma.toko.count(), prisma.produk.count()]);
  console.log(`✓ Ditambahkan ${hasil.toko} toko & ${hasil.produk} produk. Total sekarang: ${totalToko} toko, ${totalProduk} produk.`);
}

main()
  .catch((error) => {
    console.error("✗ Gagal menambahkan katalog demo:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

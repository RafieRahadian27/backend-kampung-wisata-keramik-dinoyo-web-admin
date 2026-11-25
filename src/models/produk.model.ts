/**
 * Model domain PRODUK. Tabel: `produk` (prisma/schema.prisma). Informasi toko (nama, inisial,
 * pengrajin) disalin ke baris produk saat dibuat agar daftar katalog tidak perlu JOIN.
 */
export type StatusProduk = "tersedia" | "habis" | "preorder";

/**
 * Teknik pembuatan yang diakui paguyuban — dipakai dropdown di form produk DAN validasi backend,
 * sehingga katalog tidak berisi variasi ejaan ("putar tangan", "Putar-tangan", ...).
 */
export const TEKNIK_PEMBUATAN = [
  "Putar Tangan",
  "Hand Built Coiling",
  "Cetak Tuang (Slip Casting)",
  "Pinching",
  "Slab Building",
  "Ukir Manual",
  "Cetak Tekan (Press Mold)",
  "Glasir Celup",
  "Cetak Padat & Ukir Tangan",
  "Lukis Tangan Halus",
] as const;

export interface Produk {
  id: number;
  nama: string;
  sku: string;
  /** Toko pemilik produk — dipakai untuk cek kepemilikan (ABAC). */
  tokoSlug: string;
  teknik: string;
  foto: string;
  badge?: string;
  toko: { nama: string; inisial: string; pengrajin: string };
  kategori: string;
  bahan: string;
  harga: number;
  catatanHarga: string;
  status: StatusProduk;
  stokLabel: string;
  lokasiStok: string;
  aktifPublik: boolean;
}

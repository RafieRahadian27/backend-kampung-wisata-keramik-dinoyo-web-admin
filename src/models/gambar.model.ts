/**
 * Model domain GAMBAR — catatan berkas di Vercel Blob. Tabel: `gambar`.
 *
 * Pembagian tugas:
 *   - Vercel Blob   : menyimpan berkas biner + menyajikannya lewat CDN (lib/storage.ts)
 *   - MySQL `gambar`: metadata & kepemilikan (url, ukuran, tipe, toko/produk, pengunggah)
 *   - kolom toko.foto / toko.stempel / produk.foto: URL yang sedang dipakai halaman
 * Ketiganya ditulis dalam satu alur: unggah ke Blob → transaksi DB (kolom + baris gambar + audit)
 * → bila transaksi gagal, berkas Blob baru dihapus lagi (kompensasi).
 */
export type JenisGambar = "toko_foto" | "toko_stempel" | "produk_foto";

export interface Gambar {
  id: number;
  url: string;
  pathname: string;
  contentType: string;
  /** Byte. 0 = berkas lama hasil backfill migrasi (ukuran asli tidak diketahui). */
  ukuran: number;
  jenis: JenisGambar;
  tokoId: number | null;
  produkId: number | null;
  diunggahOleh: number | null;
  dibuat: string;
}

/** Data untuk mencatat unggahan baru. */
export interface GambarInput {
  url: string;
  pathname: string;
  contentType: string;
  ukuran: number;
  jenis: JenisGambar;
  tokoId?: number;
  produkId?: number;
  diunggahOleh: number;
}

export const JENIS_GAMBAR_TOKO = { foto: "toko_foto", stempel: "toko_stempel" } as const satisfies Record<string, JenisGambar>;

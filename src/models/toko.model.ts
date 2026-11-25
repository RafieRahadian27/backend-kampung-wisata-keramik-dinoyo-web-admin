/**
 * Model domain TOKO — bentuk data toko yang dipakai service, controller, dan dikirim ke klien.
 * Struktur tabelnya sendiri ada di prisma/schema.prisma (model `Toko`); repository memetakan
 * baris Prisma ke bentuk ini (mis. relasi `toko_kategori` → array `kategori`).
 */
export type StatusToko = "terverifikasi" | "menunggu" | "nonaktif";
export type BadgeToko = "baru" | "unggulan" | "maestro";

export interface Toko {
  id: number;
  slug: string;
  nama: string;
  nib: string;
  keterangan: string;
  /** Nama pengrajin / penanggung jawab — hanya huruf, spasi, titik, petik, dan tanda hubung. */
  pemilik: string;
  nik?: string | null;
  /** Admin DTO hint only; never include private storage pathname. */
  hasFotoKtp?: boolean;
  whatsapp: string;
  lokasiGang: string;
  wilayah: string;
  alamat: string;
  /** "lat, lng" desimal, mis. "-7.9421, 112.6087" — dipakai peta sebaran lorong. */
  koordinat: string;
  spesialisasi: string;
  kategori: string[];
  jumlahProduk: number;
  tahunBerdiri: number;
  deskripsi: string;
  jamBuka: string;
  status: StatusToko;
  badge?: BadgeToko;
  foto: string;
  /** URL Vercel Blob stempel otentikasi; tidak ada bila belum diunggah. */
  stempel?: string;
  aktifPublik: boolean;
  akreditasi: boolean;
  diperbarui: string;
}

/** Data yang boleh dikirim klien saat membuat/memperbarui toko (id, slug, waktu dibuat server). */
export type TokoInput = Omit<Toko, "id" | "slug" | "diperbarui" | "hasFotoKtp"> & { fotoKtp?: string | null };

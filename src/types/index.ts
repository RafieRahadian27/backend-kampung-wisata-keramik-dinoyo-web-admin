export type StatusToko = "terverifikasi" | "menunggu" | "nonaktif";
export type BadgeToko = "baru" | "unggulan" | "maestro";

export interface Toko {
  id: number;
  slug: string;
  nama: string;
  nib: string;
  keterangan: string;
  pemilik: string;
  whatsapp: string;
  lokasiGang: string;
  wilayah: string;
  alamat: string;
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
  aktifPublik: boolean;
  akreditasi: boolean;
  diperbarui: string;
}

export type TokoInput = Omit<Toko, "id" | "slug" | "diperbarui">;

export type StatusProduk = "tersedia" | "habis" | "preorder";

export interface Produk {
  id: number;
  nama: string;
  sku: string;
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
}

export type PeranAkun = "Pemilik Toko" | "Staf Pengrajin";
export type StatusAkun = "aktif" | "menunggu" | "ditangguhkan";

export interface Akun {
  id: number;
  nama: string;
  inisial: string;
  nik: string;
  email: string;
  toko: string;
  lokasi: string;
  peran: PeranAkun;
  whatsapp: string;
  status: StatusAkun;
  terakhirAktif: string;
  tone: "primary" | "neutral" | "solid" | "tertiary" | "secondary";
}

export interface AdminUser {
  nama: string;
  sapaan: string;
  email: string;
  peran: string;
}

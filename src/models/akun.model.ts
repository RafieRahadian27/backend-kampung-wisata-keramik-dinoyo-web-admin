/** Model domain AKUN pengrajin (data pendaftaran & status keanggotaan). Tabel: `akun`. */
export type PeranAkun = "Pemilik Toko" | "Staf Pengrajin";
export type StatusAkun = "aktif" | "menunggu" | "ditangguhkan";

export interface Akun {
  id: number;
  nama: string;
  /** Diisi saat pendaftaran mandiri; akun dari data awal boleh kosong. */
  umur?: number | null;
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

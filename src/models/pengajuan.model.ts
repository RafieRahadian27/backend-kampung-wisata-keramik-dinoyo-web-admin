/**
 * Model domain PENGAJUAN toko baru (antrean verifikasi di dashboard admin). Tabel: `pengajuan`.
 *
 * Aturan bisnis timer: admin punya waktu BATAS_PENGAJUAN_JAM sejak `diajukanPada` untuk
 * memverifikasi atau menolak. Lewat dari itu pengajuan otomatis `kedaluwarsa` (dinonaktifkan):
 * tetap terlihat di antrean sebagai catatan, tetapi tidak bisa diverifikasi lagi — pengrajin
 * harus mengajukan ulang. Status ditandai "malas" (lazy) setiap antrean dibaca, tanpa cron job.
 */
export type StatusPengajuan = "menunggu" | "kedaluwarsa";

/** 3 × 24 jam. */
export const BATAS_PENGAJUAN_JAM = 72;
export const BATAS_PENGAJUAN_MS = BATAS_PENGAJUAN_JAM * 60 * 60 * 1000;

export interface Pengajuan {
  slug: string;
  nama: string;
  lokasiGang: string;
  pengrajin: string;
  keahlian: string;
  nik?: string;
  hasFotoKtp: boolean;
  whatsapp?: string;
  foto: string;
  /** ISO 8601 — awal hitung mundur. */
  diajukanPada: string;
  /** ISO 8601 — `diajukanPada` + 72 jam. Klien memakai ini untuk countdown. */
  batasWaktu: string;
  status: StatusPengajuan;
  koreksiAlasan?: string;
}

/** Baris Prisma yang dibutuhkan untuk membentuk model (lihat pengajuan.repository.ts). */
export interface PengajuanRow {
  slug: string;
  nama: string;
  lokasiGang: string;
  pengrajin: string;
  keahlian: string;
  nik?: string | null;
  fotoKtp?: string | null;
  whatsapp?: string | null;
  foto: string;
  diajukanPada: Date;
  status: StatusPengajuan;
  koreksiAlasan?: string | null;
}

export function batasWaktuPengajuan(diajukanPada: Date): Date {
  return new Date(diajukanPada.getTime() + BATAS_PENGAJUAN_MS);
}

/** Kedaluwarsa bila sudah ditandai, ATAU batasnya lewat walau belum sempat ditandai. */
export function isPengajuanKedaluwarsa(row: Pick<PengajuanRow, "diajukanPada" | "status">, now = new Date()): boolean {
  return row.status === "kedaluwarsa" || batasWaktuPengajuan(row.diajukanPada).getTime() <= now.getTime();
}

export function toPengajuan(row: PengajuanRow, now = new Date()): Pengajuan {
  return {
    slug: row.slug,
    nama: row.nama,
    lokasiGang: row.lokasiGang,
    pengrajin: row.pengrajin,
    keahlian: row.keahlian,
    nik: row.nik ?? undefined,
    hasFotoKtp: Boolean(row.fotoKtp),
    whatsapp: row.whatsapp ?? undefined,
    foto: row.foto,
    diajukanPada: row.diajukanPada.toISOString(),
    batasWaktu: batasWaktuPengajuan(row.diajukanPada).toISOString(),
    status: isPengajuanKedaluwarsa(row, now) ? "kedaluwarsa" : "menunggu",
    koreksiAlasan: row.koreksiAlasan ?? undefined,
  };
}

/**
 * Mengubah baris audit_log menjadi kalimat yang mudah dibaca pengrajin
 * (linimasa Dashboard Toko & riwayat di Profil). Aksi yang tidak dikenal tetap ditampilkan apa adanya.
 */
export type JenisAktivitas = "produk" | "toko" | "akun" | "verifikasi";

export interface AuditRow {
  id: string;
  aksi: string;
  target: string;
  detail: string;
  createdAt: Date;
  oleh: string;
}

const LABEL: Record<string, { judul: string; jenis: JenisAktivitas }> = {
  " produk:update": { judul: "Data produk diperbarwi", jenis: "produk" },
  "produk:create": { judul: "Produk baru ditambahkan", jenis: "produk" },
  "produk:delete": { judul: "Produk dihapus dari katalog", jenis: "produk" },
  "produk:foto": { judul: "Foto produk diperbarui", jenis: "produk" },
  "toko:create": { judul: "Toko didaftarkan", jenis: "toko" },
  "toko:update": { judul: "Profil toko diperbarui", jenis: "toko" },
  "toko:foto": { judul: "Foto sampul toko diunggah", jenis: "toko" },
  "toko:stempel": { judul: "Stempel otentikasi diunggah", jenis: "toko" },
  "toko:delete": { judul: "Toko dihapus", jenis: "toko" },
  "pengajuan:verifikasi": { judul: "Toko diverifikasi paguyuban", jenis: "verifikasi" },
  "pengajuan:tolak": { judul: "Pengajuan toko ditolak", jenis: "verifikasi" },
  "akun:daftar": { judul: "Akun pengrajin didaftarkan", jenis: "akun" },
  "akun:status": { judul: "Status akun diubah admin", jenis: "akun" },
  "akun:password": { judul: "Kata sandi diganti", jenis: "akun" },
  "akun:sesi": { judul: "Perangkat lain dikeluarkan", jenis: "akun" },
  "akun:profil": { judul: "Nama tampilan diubah", jenis: "akun" },
};

export function toAktivitas(row: AuditRow) {
  const known = LABEL[row.aksi] ?? (row.aksi.startsWith("toko:otomatis") ? { judul: "Toko dibuat otomatis saat akun aktif", jenis: "toko" as const } : undefined);
  // Detail teknis (path berkas Blob, ukuran) tidak berguna bagi pengguna — cukup targetnya.
  const teknis = /\.(jpe?g|png|webp)\b|\bB\)$/.test(row.detail);
  return {
    id: row.id,
    jenis: known?.jenis ?? ("toko" as JenisAktivitas),
    judul: known?.judul ?? row.aksi,
    keterangan: (!teknis && row.detail) || row.target,
    oleh: row.oleh,
    waktu: row.createdAt.toISOString(),
  };
}

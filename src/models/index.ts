/**
 * Lapisan MODEL — definisi data domain aplikasi, satu file per entitas.
 *
 *   prisma/schema.prisma → struktur TABEL (kolom, index, relasi) — dikelola migrasi
 *   src/models/*         → bentuk data DOMAIN yang dipakai service & dikirim ke klien,
 *                          beserta aturan bisnis yang melekat pada datanya (mis. batas waktu
 *                          pengajuan, daftar teknik pembuatan yang sah)
 *   src/repositories/*   → query Prisma yang memetakan baris tabel ke model di sini
 *
 * Alur MVC backend: routes → controllers → services → repositories → (models) → Prisma/MySQL.
 */
export * from "./akun.model";
export * from "./gambar.model";
export * from "./pengajuan.model";
export * from "./produk.model";
export * from "./toko.model";
export * from "./user.model";

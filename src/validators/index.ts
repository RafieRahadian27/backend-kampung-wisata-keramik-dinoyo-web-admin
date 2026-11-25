import { BAHAN_PRODUK, EMAIL, EMAIL_MAX, NAMA_ORANG, NAMA_PRODUK, NIK, USERNAME, WHATSAPP_ID } from "../lib/validate";
import { TEKNIK_PEMBUATAN } from "../models";
import { PASSWORD_MAX, PASSWORD_MIN, validatePassword } from "../lib/validatePassword";
import type { Schema } from "../utils/schema";

/** Skema input per endpoint. Dipakai oleh middleware `validate()` di setiap router. */

export const loginSchema: Schema = {
  identifier: { type: "string", label: "Email/username", required: true, max: EMAIL_MAX },
  password: { type: "string", label: "Kata sandi", required: true, max: 200 },
  remember: { type: "boolean", default: false },
};

/**
 * Aturan format pendaftaran (lihat src/lib/validate.ts & validatePassword.ts).
 * Validasi di browser hanya untuk kenyamanan, yang di sini adalah penentu akhir.
 */
export const registerSchema: Schema = {
  nama: { type: "string", label: "Nama lengkap", required: true, min: 3, max: 100, pattern: NAMA_ORANG, patternMessage: "Nama lengkap hanya boleh berisi huruf, spasi, titik, atau tanda petik" },
  umur: { type: "number", label: "Umur", required: true, integer: true, min: 17, max: 100 },
  nik: { type: "string", label: "NIK", required: true, pattern: NIK, patternMessage: "NIK harus 16 digit angka" },
  whatsapp: { type: "string", label: "Nomor WhatsApp", required: true, pattern: WHATSAPP_ID, patternMessage: "Nomor WhatsApp harus diawali 08 atau 62 dan berisi 10–14 digit" },
  ktpUploadToken: { type: "string", label: "Token unggahan KTP", required: true, min: 43, max: 43, pattern: /^[A-Za-z0-9_-]{43}$/ },
  toko: { type: "string", label: "Nama toko", required: true, min: 3, max: 60 },
  lokasi: { type: "string", label: "Lokasi toko", required: true, min: 5, max: 100 },
  peran: { type: "string", label: "Peran", required: true, enum: ["Pemilik Toko", "Staf Pengrajin"] },
  username: { type: "string", label: "Username", required: true, pattern: USERNAME, patternMessage: "Username 4–20 karakter, diawali huruf, hanya huruf/angka/garis bawah" },
  email: { type: "string", label: "Email", required: true, max: EMAIL_MAX, pattern: EMAIL, patternMessage: "Format email tidak valid (contoh: nama@gmail.com)" },
  password: {
    type: "string",
    label: "Kata sandi",
    required: true,
    min: PASSWORD_MIN,
    max: PASSWORD_MAX,
    // Huruf besar + huruf kecil + angka, tanpa spasi, tidak memuat username/email.
    check: (password, input) => validatePassword(password, { username: input.username, email: input.email }),
  },
};

const KOORDINAT = /^-?\d{1,2}(\.\d+)?,\s*-?\d{1,3}(\.\d+)?$/;

/** Untuk POST. PUT memakai skema yang sama dalam mode parsial. */
export const tokoSchema: Schema = {
  nama: { type: "string", label: "Nama toko", required: true, min: 3, max: 60 },
  // Nama pengrajin: hanya huruf (+ spasi, titik untuk gelar "H." / "Bpk.", petik, tanda hubung). Angka & simbol ditolak.
  pemilik: { type: "string", label: "Nama pengrajin", required: true, min: 3, max: 100, pattern: NAMA_ORANG, patternMessage: "Nama pengrajin hanya boleh berisi huruf, spasi, titik, petik, atau tanda hubung" },
  tahunBerdiri: { type: "number", label: "Tahun berdiri", required: true, integer: true, min: 1900, max: () => new Date().getFullYear() },
  kategori: { type: "array", label: "Kategori", maxItems: 8, itemMax: 60, default: [] },
  deskripsi: { type: "string", label: "Deskripsi", max: 2000, default: "" },
  wilayah: { type: "string", label: "Wilayah", required: true, max: 120 },
  alamat: { type: "string", label: "Alamat", max: 200, default: "" },
  koordinat: { type: "string", label: "Koordinat", max: 40, pattern: KOORDINAT, patternMessage: "Koordinat harus berformat 'lat, lng'" },
  // Hanya digit: diawali 08 atau 62, total 10–14 digit (sama dengan pendaftaran akun).
  whatsapp: { type: "string", label: "Nomor WhatsApp", required: true, pattern: WHATSAPP_ID, patternMessage: "Nomor WhatsApp hanya angka, diawali 08 atau 62, 10–14 digit" },
  jamBuka: { type: "string", label: "Jam buka", required: true, max: 80 },
  aktifPublik: { type: "boolean", default: false },
  akreditasi: { type: "boolean", default: false },
  status: { type: "string", label: "Status paguyuban", enum: ["terverifikasi", "menunggu", "nonaktif"], default: "menunggu" },
};

export const tokoQuerySchema: Schema = {
  q: { type: "string", max: 100 },
  status: { type: "string", enum: ["terverifikasi", "menunggu", "nonaktif"] },
  lokasi: { type: "string", max: 60 },
  kategori: { type: "string", max: 60 },
};

export const produkQuerySchema: Schema = {
  q: { type: "string", max: 100 },
  kategori: { type: "string", max: 60 },
  toko: { type: "string", max: 100 },
};

export const correctionSchema: Schema = {
  alasan: { type: "string", label: "Alasan koreksi", required: true, min: 1, max: 500 },
};

export const produkPublicSchema: Schema = {
  aktifPublik: { type: "boolean", required: true },
};

export const akunQuerySchema: Schema = {
  q: { type: "string", max: 100 },
  peran: { type: "string", enum: ["Pemilik Toko", "Staf Pengrajin"] },
  status: { type: "string", enum: ["aktif", "menunggu", "ditangguhkan"] },
};

export const akunStatusSchema: Schema = {
  status: { type: "string", label: "Status akun", required: true, enum: ["aktif", "menunggu", "ditangguhkan"] },
};

export const keputusanSchema: Schema = {
  keputusan: { type: "string", label: "Keputusan", required: true, enum: ["verifikasi", "tolak"] },
};

/** Produk baru. Kategori dicek ulang terhadap tabel master `kategori_produk` di service. */
export const produkSchema: Schema = {
  tokoSlug: { type: "string", label: "Toko", required: true, max: 80 },
  nama: { type: "string", label: "Nama produk", required: true, min: 3, max: 120, pattern: NAMA_PRODUK, patternMessage: "Nama produk hanya boleh berisi huruf, spasi, dan tanda baca sederhana (. , - & ( ) / ') — tanpa angka" },
  kategori: { type: "string", label: "Kategori", required: true, max: 60 },
  // Daftar tertutup (models/produk.model.ts) — sama dengan pilihan dropdown di form produk.
  teknik: { type: "string", label: "Teknik pembuatan", required: true, enum: TEKNIK_PEMBUATAN },
  bahan: { type: "string", label: "Bahan", required: true, min: 3, max: 80, pattern: BAHAN_PRODUK, patternMessage: "Bahan hanya boleh berisi huruf, angka, spasi, dan tanda baca sederhana" },
  harga: { type: "number", label: "Harga", required: true, integer: true, min: 1000, max: 100_000_000 },
  catatanHarga: { type: "string", label: "Catatan harga", max: 80, default: "" },
  status: { type: "string", label: "Status stok", required: true, enum: ["tersedia", "habis", "preorder"] },
  stok: { type: "number", label: "Jumlah stok", integer: true, min: 0, max: 100_000, default: 0 },
  lokasiStok: { type: "string", label: "Lokasi stok", required: true, min: 2, max: 80 },
  badge: { type: "string", label: "Label", max: 40, default: "" },
};

/** Ganti kata sandi: sandi baru mengikuti aturan pendaftaran dan harus berbeda dari yang lama. */
export const produkUpdateSchema: Schema = {
  nama: { type: "string", label: "Nama produk", min: 3, max: 120, pattern: NAMA_PRODUK, patternMessage: "Nama produk hanya boleh berisi huruf, spasi, dan tanda baca sederhana (. , - & ( ) / ') â tanpa angka" },
  kategori: { type: "string", label: "Kategori", max: 60 },
  teknik: { type: "string", label: "Teknik pembuatan", enum: TEKNIK_PEMBUATAN },
  bahan: { type: "string", label: "Bahan", min: 3, max: 80, pattern: BAHAN_PRODUK, patternMessage: "Bahan hanya boleh berisi huruf, angka, spasi, dan tanda baca sederhane" },
  harga: { type: "number", label: "Harga", integer: true, min: 1000, max: 100_000_000 },
  catatanHarga: { type: "string", label: "Catatan harga", max: 80 },
  status: { type: "string", label: "Status stok", enum: ["tersedia", "habis", "preorder"] },
  stok: { type: "number", label: "Jumlah stok", integer: true, min: 0, max: 100_000 },
  lokasiStok: { type: "string", label: "Lokasi stok", min: 2, max: 80 },
  badge: { type: "string", label: "Label", max: 40 },
};

export const passwordSchema: Schema = {
  passwordLama: { type: "string", label: "Kata sandi saat ini", required: true, max: 200 },
  passwordBaru: {
    type: "string",
    label: "Kata sandi baru",
    required: true,
    min: PASSWORD_MIN,
    max: PASSWORD_MAX,
    check: (password, input) => (password === input.passwordLama ? "Kata sandi baru harus berbeda dari kata sandi saat ini" : undefined),
  },
};

export const laporanTokoQuerySchema: Schema = {
  periode: { type: "string", label: "Periode", enum: ["7", "30", "90"], default: "30" },
};

/** Nama tampilan (sapaan) di panel. Nama lengkap, NIK, dan kontak tetap diubah lewat admin. */
export const profilSchema: Schema = {
  sapaan: {
    type: "string",
    label: "Nama tampilan",
    required: true,
    min: 3,
    max: 60,
    pattern: NAMA_ORANG,
    patternMessage: "Nama tampilan hanya boleh berisi huruf, spasi, titik, atau tanda petik",
  },
};

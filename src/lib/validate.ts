/**
 * Aturan validasi input backend yang dipakai ulang (skema endpoint, rate limiter, service).
 * Pola regex disamakan dengan `frontend/src/lib/validation/auth.ts` — validasi di browser hanya
 * untuk kenyamanan pengguna, sedangkan yang di sini adalah penentu akhir, karena request bisa
 * dikirim tanpa melalui form web (Postman, curl, skrip).
 */

/** Email "masuk akal": satu @, tanpa titik di awal/akhir/berurutan, domain ber-TLD huruf. */
export const EMAIL = /^(?!\.)(?!.*\.\.)[A-Za-z0-9._%+-]+(?<!\.)@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;
export const EMAIL_MAX = 120;
/** 4–20 karakter, diawali huruf, hanya huruf/angka/garis bawah. */
export const USERNAME = /^[A-Za-z][A-Za-z0-9_]{3,19}$/;
/** Nama orang: hanya huruf (semua aksara), spasi, titik (gelar "H.", "Bpk."), petik, tanda hubung. Tanpa angka/simbol. */
export const NAMA_ORANG = /^[\p{L}][\p{L} .'-]*$/u;
/** Nama produk: HANYA huruf, spasi & tanda baca sederhana — tanpa angka (aturan paguyuban). */
export const NAMA_PRODUK = /^[\p{L}][\p{L} .,'&()/-]*$/u;
/** Bahan: boleh angka (mis. "Kiln 1100°"), tetap menolak <, >, emoji, dsb. */
export const BAHAN_PRODUK = /^[\p{L}\p{N}][\p{L}\p{N} .,'&()/°-]*$/u;
export const NIK = /^\d{16}$/;
export const WHATSAPP_ID = /^(?:\+?62|0)8\d{8,11}$/;

/** Type guard: nilai berupa string yang tidak kosong setelah di-trim. */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export function isEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= EMAIL_MAX && EMAIL.test(value.trim());
}

/** Email & username disimpan huruf kecil agar "Budi@Mail.com" dan "budi@mail.com" dianggap sama. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Kolom login menerima email ATAU username; keduanya dibandingkan dalam huruf kecil. */
export function normalizeIdentifier(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, EMAIL_MAX) : "";
}

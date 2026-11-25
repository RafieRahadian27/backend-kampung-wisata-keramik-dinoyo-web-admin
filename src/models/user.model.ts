/** Model domain PENGGUNA (login) beserta peran & izinnya. Tabel: `users`, `user_toko`. */
export type Role = "admin" | "pengrajin";

export type Permission =
  | "dashboard:read"
  | "laporan:read"
  | "toko:read"
  | "toko:create"
  | "toko:update"
  | "toko:delete"
  | "pengajuan:decide"
  | "produk:read"
  | "produk:delete"
  | "akun:read"
  | "akun:update"
  | "beranda:read"
  | "produk:create" | "produk:update"
  | "laporan-toko:read"
  | "profil:update";

/** Baris tabel pengguna — hanya hidup di server, tidak pernah dikirim ke klien. */
export interface UserRecord {
  id: number;
  nama: string;
  sapaan: string;
  email: string;
  username: string;
  passwordHash: string;
  role: Role;
  /** Tautan ke data akun pengrajin (status aktif/ditangguhkan). */
  akunId?: number;
  /** Toko yang dimiliki pengguna — atribut untuk ABAC. */
  tokoSlugs: string[];
}

/** Profil pengguna yang aman dikirim ke klien (tanpa hash kata sandi). */
export interface AdminUser {
  id: number;
  nama: string;
  sapaan: string;
  email: string;
  /** Label peran untuk tampilan. */
  peran: string;
  role: Role;
  izin: Permission[];
  tokoSlugs: string[];
}

/** Authenticated server principal; never serialize this type to clients. */
export interface AuthenticatedUser extends AdminUser {
  /** Server-only account link for authorization and account lookups. */
  akunId?: number | null;
}

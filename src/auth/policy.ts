import type { Prisma } from "../generated/prisma/client";
import type { AdminUser, Permission, Role, TokoInput } from "../types";

/**
 * Kebijakan otorisasi terpusat — satu-satunya tempat aturan akses ditulis.
 *
 * RBAC: izin diturunkan dari peran (admin / pengrajin).
 * ABAC: keputusan juga melihat atribut data, mis. "pengrajin hanya boleh
 *       mengubah toko miliknya sendiri" (lihat `ownsToko`).
 */
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: [
    "dashboard:read",
    "laporan:read",
    "toko:read",
    "toko:create",
    "toko:update",
    "toko:delete",
    "pengajuan:decide",
    "produk:read",
    "produk:create", "produk:update",
    "produk:delete",
    "akun:read",
    "akun:update",
    "profil:update",
  ],
  pengrajin: [
    "beranda:read",
    "toko:read",
    "toko:update",
    "produk:read",
    "produk:create", "produk:update",
    "produk:delete",
    "laporan-toko:read",
    "profil:update",
  ],
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin Paguyuban",
  pengrajin: "Pemilik Toko",
};

export function permissionsOf(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function hasPermission(user: Pick<AdminUser, "role">, permission: Permission): boolean {
  return ROLE_PERMISSIONS[user.role].includes(permission);
}

/**
 * ABAC: admin boleh mengakses semua toko, pengrajin hanya toko yang tercatat miliknya.
 * Dikembalikan sebagai filter `where` Prisma (setara `WHERE id IN (SELECT toko_id FROM user_toko
 * WHERE user_id = ?)`) sehingga penyaringan terjadi di database dan setiap query toko/produk
 * wajib menyertakannya.
 */
export function tokoScope(user: Pick<AdminUser, "id" | "role">): Prisma.TokoWhereInput {
  if (user.role === "admin") return {};
  return { pengguna: { some: { userId: user.id } } };
}

/**
 * Field toko yang boleh dikirim per peran (whitelist, mencegah mass assignment).
 * Akreditasi dan status adalah keputusan paguyuban, jadi pengrajin tidak bisa mengubahnya sendiri.
 */
const TOKO_FIELDS: (keyof TokoInput)[] = [
  "nama",
  "pemilik",
  "tahunBerdiri",
  "kategori",
  "deskripsi",
  "wilayah",
  "alamat",
  "koordinat",
  "whatsapp",
  "jamBuka",
  "aktifPublik",
  "akreditasi",
  "status",
];

const TOKO_FIELDS_BY_ROLE: Record<Role, (keyof TokoInput)[]> = {
  admin: TOKO_FIELDS,
  pengrajin: TOKO_FIELDS.filter((field) => field !== "akreditasi" && field !== "status"),
};

/** Dijalankan setelah `validate()`: skema menentukan bentuk data, fungsi ini menentukan hak per peran. */
export function pickTokoFields(user: Pick<AdminUser, "role">, body: unknown): Partial<TokoInput> {
  const source = (body ?? {}) as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const field of TOKO_FIELDS_BY_ROLE[user.role]) {
    if (source[field] !== undefined) picked[field] = source[field];
  }
  return picked as Partial<TokoInput>;
}

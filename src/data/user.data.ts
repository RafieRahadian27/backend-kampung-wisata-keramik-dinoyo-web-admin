import { hashPasswordSync } from "../auth/password";
import type { UserRecord } from "../types";

/**
 * Tabel pengguna demo. Kata sandi di-hash saat server mulai; di database nyata
 * hanya kolom `passwordHash` yang tersimpan.
 *
 * Akun demo:
 *  - admin@keramikdinoyo.id  / dinoyo123   → Admin Paguyuban (semua akses)
 *  - bambang@sariasihkeramik.id / sariasih123 → Pemilik Toko Sari Asih
 *  - sri@gerabahdinoyo.id    / gerabah123  → Pemilik Sanggar Gerabah Ibu Sri
 *  - joko@suvenirmelati.com  / melati123   → akun ditangguhkan (login ditolak 403)
 */
export const userSeed: UserRecord[] = [
  {
    id: 1,
    nama: "Admin Dinoyo",
    sapaan: "Pak Joko Santoso",
    email: "admin@keramikdinoyo.id",
    username: "admin",
    passwordHash: hashPasswordSync("dinoyo123"),
    role: "admin",
    tokoSlugs: [],
  },
  {
    id: 2,
    nama: "Pak Bambang Irawan",
    sapaan: "Pak Bambang",
    email: "bambang@sariasihkeramik.id",
    username: "bambang",
    passwordHash: hashPasswordSync("sariasih123"),
    role: "pengrajin",
    akunId: 1,
    tokoSlugs: ["toko-keramik-sari-asih"],
  },
  {
    id: 3,
    nama: "Ibu Sri Hartatik",
    sapaan: "Ibu Sri",
    email: "sri@gerabahdinoyo.id",
    username: "sri",
    passwordHash: hashPasswordSync("gerabah123"),
    role: "pengrajin",
    akunId: 3,
    tokoSlugs: ["sanggar-gerabah-ibu-sri"],
  },
  {
    id: 4,
    nama: "Joko Susilo",
    sapaan: "Pak Joko",
    email: "joko@suvenirmelati.com",
    username: "joko",
    passwordHash: hashPasswordSync("melati123"),
    role: "pengrajin",
    akunId: 6,
    tokoSlugs: ["toko-suvenir-melati"],
  },
];

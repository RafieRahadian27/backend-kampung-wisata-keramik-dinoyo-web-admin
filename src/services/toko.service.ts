import { IMAGE_EXTENSION } from "../lib/fileType";
import { isDuplicateEntry, prisma, withTransaction } from "../lib/prisma";
import { storage } from "../lib/storage";
import { auditRepository } from "../repositories/audit.repository";
import { gambarRepository } from "../repositories/gambar.repository";
import { JENIS_GAMBAR_TOKO } from "../models";
import { type TokoFilter, tokoRepository } from "../repositories/toko.repository";
import type { AdminUser, Toko, TokoInput } from "../types";
import type { UploadedFile } from "../types/express";
import { HttpError } from "../utils/httpError";
import { slugify } from "../utils/slugify";

export type { TokoFilter };

/** Nilai awal toko baru — dipakai form Tambah Toko dan pembuatan toko otomatis saat akun diaktifkan. */
export const DEFAULT_TOKO: Omit<TokoInput, "nama" | "pemilik" | "tahunBerdiri" | "wilayah" | "whatsapp" | "jamBuka"> = {
  nib: "-",
  keterangan: "Pendaftar baru",
  lokasiGang: "-",
  alamat: "",
  koordinat: "-7.9421, 112.6087",
  spesialisasi: "Semi-Porselen",
  kategori: [],
  jumlahProduk: 0,
  deskripsi: "",
  status: "menunggu",
  badge: "baru",
  foto: "/images/sampul-galeri.jpg",
  aktifPublik: false,
  akreditasi: false,
};

/** Media toko yang bisa diunggah: kolom referensinya di tabel toko & nama dasar berkas di Blob. */
export const MEDIA_TOKO = {
  foto: { kolom: "foto", berkas: "sampul" },
  stempel: { kolom: "stempel", berkas: "stempel" },
} as const;
export type MediaToko = keyof typeof MEDIA_TOKO;

const notFound = (slug: string) => new HttpError(404, `Toko dengan slug "${slug}" tidak ditemukan`);

/**
 * Setiap query selalu disaring dengan kepemilikan pengguna yang sedang login
 * (lihat `tokoScope`). Toko milik orang lain diperlakukan seolah tidak ada → 404,
 * sehingga mengganti slug di URL tidak membocorkan data (IDOR).
 */
export const tokoService = {
  findFotoKtp(slug: string): Promise<string | null> {
    return tokoRepository.findFotoKtp(prisma, slug);
  },

  findAll(user: AdminUser, filter: TokoFilter = {}): Promise<Toko[]> {
    return tokoRepository.findMany(prisma, user, filter);
  },

  async findBySlug(user: AdminUser, slug: string): Promise<Toko> {
    const toko = await tokoRepository.findBySlug(prisma, user, slug);
    if (!toko) throw notFound(slug);
    return toko;
  },

  /** Admin melihat agregat seluruh direktori; pengrajin hanya tokonya sendiri. */
  ringkasan(user: AdminUser) {
    return tokoRepository.ringkasan(prisma, user);
  },

  /** Transaksi: INSERT toko + INSERT kategori + INSERT audit — berhasil semua atau batal semua. */
  async create(user: AdminUser, input: TokoInput): Promise<Toko> {
    const slug = slugify(input.nama);
    try {
      await withTransaction(async (tx) => {
        await tokoRepository.insert(tx, slug, input);
        await auditRepository.insert(tx, { userId: user.id, aksi: "toko:create", target: slug });
      });
    } catch (error) {
      // UNIQUE(slug) di database adalah penjaga sebenarnya, aman walau ada dua request bersamaan.
      if (isDuplicateEntry(error)) throw new HttpError(409, "Nama toko sudah terdaftar di direktori");
      throw error;
    }
    return this.findBySlug(user, slug);
  },

  async update(user: AdminUser, slug: string, input: Partial<TokoInput>): Promise<Toko> {
    await withTransaction(async (tx) => {
      const toko = await tokoRepository.lockBySlug(tx, user, slug);
      if (!toko) throw notFound(slug);
      await tokoRepository.update(tx, toko.id, input);
      await auditRepository.insert(tx, { userId: user.id, aksi: "toko:update", target: slug, detail: Object.keys(input).join(",") });
    });
    return this.findBySlug(user, slug);
  },

  /**
   * Ganti media toko (foto sampul / stempel): Simpan ke Storage → Catat Referensinya → bersihkan berkas lama.
   *
   * Berkas diunggah lebih dulu (di luar transaksi, agar row lock tidak tertahan selama upload
   * jaringan). Bila pencatatan ke database gagal, berkas baru dihapus lagi (kompensasi) sehingga
   * tidak ada berkas yatim. Berkas lama baru dihapus SETELAH COMMIT berhasil.
   */
  async updateMedia(user: AdminUser, slug: string, jenis: MediaToko, file: UploadedFile): Promise<Toko> {
    // Cek kepemilikan (ABAC) sebelum menyentuh storage: toko orang lain → 404, tanpa biaya unggah.
    await this.findBySlug(user, slug);

    const { kolom, berkas } = MEDIA_TOKO[jenis];
    const uploaded = await storage.upload(`toko/${slug.slice(0, 60)}/${berkas}.${IMAGE_EXTENSION[file.contentType]}`, file.buffer, file.contentType);
    let berkasLama: string | null;
    try {
      berkasLama = await withTransaction(async (tx) => {
        const toko = await tokoRepository.lockBySlug(tx, user, slug);
        if (!toko) throw notFound(slug);
        await tokoRepository.update(tx, toko.id, { [kolom]: uploaded.url });
        // Catatan berkas di tabel gambar: yang lama dilepas, yang baru dicatat — satu transaksi dengan kolom toko.
        await gambarRepository.removeByUrl(tx, toko[kolom]);
        await gambarRepository.insert(tx, {
          url: uploaded.url,
          pathname: uploaded.pathname,
          contentType: file.contentType,
          ukuran: file.size,
          jenis: JENIS_GAMBAR_TOKO[jenis],
          tokoId: toko.id,
          diunggahOleh: user.id,
        });
        await auditRepository.insert(tx, {
          userId: user.id,
          aksi: `toko:${jenis}`,
          target: slug,
          detail: `${uploaded.pathname} (${file.contentType}, ${file.size} B)`.slice(0, 255),
        });
        return toko[kolom];
      });
    } catch (error) {
      await storage.remove(uploaded.url);
      throw error;
    }

    if (berkasLama !== uploaded.url) await storage.remove(berkasLama);
    return this.findBySlug(user, slug);
  },

  async remove(user: AdminUser, slug: string): Promise<void> {
    const media = await withTransaction(async (tx) => {
      const toko = await tokoRepository.lockBySlug(tx, user, slug);
      if (!toko) throw notFound(slug);
      await tokoRepository.remove(tx, toko.id);
      await auditRepository.insert(tx, { userId: user.id, aksi: "toko:delete", target: slug, detail: toko.nama });
      return [toko.foto, toko.stempel];
    });
    // Foto & stempel di Vercel Blob ikut dibersihkan setelah data toko benar-benar terhapus.
    await Promise.all(media.map((url) => storage.remove(url)));
  },
};

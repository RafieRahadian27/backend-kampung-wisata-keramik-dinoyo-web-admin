import { randomUUID } from "node:crypto";
import { IMAGE_EXTENSION } from "../lib/fileType";
import { prisma, withTransaction } from "../lib/prisma";
import { storage } from "../lib/storage";
import { auditRepository } from "../repositories/audit.repository";
import { gambarRepository } from "../repositories/gambar.repository";
import { type ProdukFilter, produkRepository } from "../repositories/produk.repository";
import { tokoRepository } from "../repositories/toko.repository";
import type { AdminUser, Produk, StatusProduk } from "../types";
import type { UploadedFile } from "../types/express";
import { HttpError } from "../utils/httpError";

export type { ProdukFilter };

/** Input `POST /produk` setelah lolos `produkSchema`. */
export interface ProdukInput {
  tokoSlug: string;
  nama: string;
  kategori: string;
  teknik: string;
  bahan: string;
  harga: number;
  catatanHarga: string;
  status: StatusProduk;
  stok: number;
  lokasiStok: string;
  badge: string;
}

/** Foto bawaan sampai pengrajin mengunggah foto produknya sendiri. */
export const DEFAULT_FOTO_PRODUK = "/images/sampul-galeri.jpg";

const inisialToko = (nama: string) =>
  nama
    .split(/\s+/)
    .filter((kata) => /^\p{L}/u.test(kata) && !/^(toko|galeri|sanggar|studio)$/i.test(kata))
    .slice(0, 2)
    .map((kata) => kata[0].toUpperCase())
    .join("") || nama.slice(0, 2).toUpperCase();

/** Kode SKU dari kategori: "Vas Bunga & Guci" → "VAS", "Tableware & Cangkir" → "TAB". */
const kodeKategori = (kategori: string) => (kategori.replace(/[^A-Za-z]/g, "").slice(0, 3) || "PRD").toUpperCase();

function labelStok(status: StatusProduk, stok: number) {
  if (status === "habis") return "Stok Habis";
  if (status === "preorder") return stok > 0 ? `Pre-order (${stok} slot)` : "Pre-order";
  return `Tersedia (${stok} pcs)`;
}

const notFound = () => new HttpError(404, "Produk tidak ditemukan");

/** Sama seperti toko: query produk selalu dibatasi ke toko milik pengguna (ABAC). */
export const produkService = {
  findAll(user: AdminUser, filter: ProdukFilter = {}): Promise<Produk[]> {
    return produkRepository.findMany(prisma, user, filter);
  },

  kategori(user: AdminUser) {
    return produkRepository.kategori(prisma, user);
  },

  ringkasan(user: AdminUser) {
    return produkRepository.ringkasan(prisma, user);
  },

  hargaPasar() {
    return produkRepository.hargaPasar(prisma);
  },

  async findById(user: AdminUser, id: number): Promise<Produk> {
    const produk = await produkRepository.findById(prisma, user, id);
    if (!produk) throw notFound();
    return produk;
  },

  /**
   * Transaksi: kunci toko (harus milik pengguna — ABAC) → simpan produk → tetapkan SKU final
   * berbasis ID → tambah jumlah produk toko → catat audit. Toko orang lain diperlakukan sebagai
   * tidak ada (404) agar keberadaannya tidak bocor.
   */
  async create(user: AdminUser, input: ProdukInput): Promise<Produk> {
    if (!(await produkRepository.kategoriExists(prisma, input.kategori))) {
      throw new HttpError(422, "Kategori produk tidak dikenal", { details: [{ field: "kategori", message: "Pilih kategori dari daftar" }] });
    }

    const id = await withTransaction(async (tx) => {
      const toko = await tokoRepository.lockBySlug(tx, user, input.tokoSlug);
      if (!toko) {
        throw new HttpError(404, "Toko tidak ditemukan", { details: [{ field: "tokoSlug", message: "Pilih toko milik Anda" }] });
      }
      const label = await tokoRepository.findLabelForProduk(tx, toko.id);
      const produkId = await produkRepository.insert(tx, {
        nama: input.nama,
        sku: `TMP-${randomUUID().slice(0, 24)}`,
        tokoId: toko.id,
        tokoLabel: toko.nama,
        tokoInisial: inisialToko(toko.nama),
        pengrajin: label?.pemilik ?? toko.nama,
        teknik: input.teknik,
        foto: DEFAULT_FOTO_PRODUK,
        badge: input.badge || null,
        kategori: input.kategori,
        bahan: input.bahan,
        harga: input.harga,
        catatanHarga: input.catatanHarga,
        status: input.status,
        aktifPublik: true,
        stokLabel: labelStok(input.status, input.stok),
        lokasiStok: input.lokasiStok,
      });
      await produkRepository.setSku(tx, produkId, `DNY-${kodeKategori(input.kategori)}-${String(produkId).padStart(3, "0")}`);
      await tokoRepository.adjustJumlahProduk(tx, toko.id, 1);
      await auditRepository.insert(tx, {
        userId: user.id,
        aksi: "produk:create",
        target: String(produkId),
        detail: `${input.nama} · ${toko.nama}`.slice(0, 255),
      });
      return produkId;
    });

    return this.findById(user, id);
  },

  /** Unggah foto produk ke Vercel Blob (alur sama dengan foto sampul toko). */
  async update(user: AdminUser, id: number, input: Partial<ProdukInput>): Promise<Produk> {
  await this.findById(user, id);
  if (input.kategori && !(await produkRepository.kategoriExists(prisma, input.kategori))) {
    throw new HttpError(422, "Kategori produk tidak dikenal", { details: [{ field: "kategori", message: "Pilih kategori dari daftar" }] });
  }
  await produkRepository.update(prisma, id, {
    ...(input.nama ? { nama: input.nama } : {}),
    ...(input.teknik ? { teknik: input.teknik } : {}),
    ...(input.bahan ? { bahan: input.bahan } : {}),
    ...(input.kategori ? { kategori: input.kategori } : {}),
    ...(input.harga !== undefined ? { harga: input.harga } : {}),
    ...(input.catatanHarga !== undefined ? { catatanHarga: input.catatanHarga } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.stok !== undefined ? { stok: input.stok } : {}),
    ...(input.lokasiStok ? { lokasiStok: input.lokasiStok } : {}),
    ...(input.badge !== undefined ? { badge: input.badge || null } : {}),
    ...(input.status || input.stok !== undefined ? { stokLabel: labelStok(input.status ?? "tersedia", input.stok ?? 0) } : {})
  });
  await auditRepository.insert(prisma, {
    userId: user.id,
    aksi: "produk:update",
    target: String(id),
    detail: input.nama || ("Produk #" + id),
  });
  return this.findById(user, id);
},
async updateFoto(user: AdminUser, id: number, file: UploadedFile): Promise<Produk> {
    // Cek kepemilikan sebelum menyentuh storage: produk toko lain → 404, tanpa biaya unggah.
    await this.findById(user, id);

    const uploaded = await storage.upload(`produk/${id}/foto.${IMAGE_EXTENSION[file.contentType]}`, file.buffer, file.contentType);
    let fotoLama: string;
    try {
      fotoLama = await withTransaction(async (tx) => {
        const produk = await produkRepository.lockById(tx, user, id);
        if (!produk) throw notFound();
        await produkRepository.setFoto(tx, id, uploaded.url);
        await gambarRepository.removeByUrl(tx, produk.foto);
        await gambarRepository.insert(tx, {
          url: uploaded.url,
          pathname: uploaded.pathname,
          contentType: file.contentType,
          ukuran: file.size,
          jenis: "produk_foto",
          produkId: id,
          diunggahOleh: user.id,
        });
        await auditRepository.insert(tx, {
          userId: user.id,
          aksi: "produk:foto",
          target: String(id),
          detail: `${uploaded.pathname} (${file.contentType}, ${file.size} B)`.slice(0, 255),
        });
        return produk.foto;
      });
    } catch (error) {
      await storage.remove(uploaded.url);
      throw error;
    }

    if (fotoLama !== uploaded.url) await storage.remove(fotoLama);
    return this.findById(user, id);
  },

  async setPublic(user: AdminUser, id: number, aktifPublik: boolean): Promise<Produk> {
    const changed = await produkRepository.setPublic(prisma, user, id, aktifPublik);
    if (!changed.count) throw notFound();
    await auditRepository.insert(prisma, { userId: user.id, aksi: "produk:visibility", target: String(id), detail: `aktifPublik=${aktifPublik}` });
    return this.findById(user, id);
  },

  /** Transaksi: hapus produk + kurangi jumlah produk di toko + catat audit. */
  async remove(user: AdminUser, id: number): Promise<void> {
    const foto = await withTransaction(async (tx) => {
      const produk = await produkRepository.lockById(tx, user, id);
      if (!produk) throw notFound();
      await produkRepository.remove(tx, id);
      await tokoRepository.adjustJumlahProduk(tx, produk.tokoId, -1);
      await auditRepository.insert(tx, { userId: user.id, aksi: "produk:delete", target: String(id), detail: produk.nama });
      return produk.foto;
    });
    // Foto bawaan (/images/...) diabaikan storage.remove; hanya berkas Vercel Blob yang dihapus.
    await storage.remove(foto);
  },
};

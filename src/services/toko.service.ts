import { pengajuanSeed, tokoSeed } from "../data/toko.data";
import type { StatusToko, Toko, TokoInput } from "../types";
import { HttpError } from "../utils/httpError";
import { slugify } from "../utils/slugify";

/** Penyimpanan in-memory (pengganti database untuk keperluan demo). */
let tokoList: Toko[] = structuredClone(tokoSeed);
let pengajuanList = structuredClone(pengajuanSeed);

export interface TokoFilter {
  q?: string;
  status?: StatusToko;
  lokasi?: string;
  kategori?: string;
}

export const tokoService = {
  findAll(filter: TokoFilter = {}): Toko[] {
    const keyword = filter.q?.trim().toLowerCase();
    return tokoList.filter((toko) => {
      const cocokKeyword =
        !keyword ||
        [toko.nama, toko.pemilik, toko.nib].some((field) => field.toLowerCase().includes(keyword));
      const cocokStatus = !filter.status || toko.status === filter.status;
      const cocokLokasi = !filter.lokasi || toko.lokasiGang.startsWith(filter.lokasi);
      const cocokKategori = !filter.kategori || toko.spesialisasi === filter.kategori;
      return cocokKeyword && cocokStatus && cocokLokasi && cocokKategori;
    });
  },

  findBySlug(slug: string): Toko {
    const toko = tokoList.find((item) => item.slug === slug);
    if (!toko) throw new HttpError(404, `Toko dengan slug "${slug}" tidak ditemukan`);
    return toko;
  },

  /** Angka agregat seluruh direktori (data contoh hanya memuat sebagian toko). */
  ringkasan() {
    return { total: 28, terverifikasi: 22, menunggu: 4, nonaktif: 2, katalogAktif: 436 };
  },

  create(input: TokoInput): Toko {
    const slug = slugify(input.nama);
    if (tokoList.some((toko) => toko.slug === slug)) {
      throw new HttpError(409, "Nama toko sudah terdaftar di direktori");
    }
    const toko: Toko = {
      ...input,
      id: Math.max(0, ...tokoList.map((item) => item.id)) + 1,
      slug,
      diperbarui: new Date().toISOString(),
    };
    tokoList = [toko, ...tokoList];
    return toko;
  },

  update(slug: string, input: Partial<TokoInput>): Toko {
    const existing = this.findBySlug(slug);
    const updated: Toko = { ...existing, ...input, slug, diperbarui: new Date().toISOString() };
    tokoList = tokoList.map((toko) => (toko.slug === slug ? updated : toko));
    return updated;
  },

  remove(slug: string): void {
    this.findBySlug(slug);
    tokoList = tokoList.filter((toko) => toko.slug !== slug);
  },

  pengajuan() {
    return pengajuanList;
  },

  /** Menyetujui atau menolak pengajuan toko baru dari panel verifikasi. */
  putuskanPengajuan(slug: string, keputusan: "verifikasi" | "tolak") {
    const pengajuan = pengajuanList.find((item) => item.slug === slug);
    if (!pengajuan) throw new HttpError(404, "Pengajuan tidak ditemukan");
    pengajuanList = pengajuanList.filter((item) => item.slug !== slug);
    return { ...pengajuan, keputusan };
  },
};

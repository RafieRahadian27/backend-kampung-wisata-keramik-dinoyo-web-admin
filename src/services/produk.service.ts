import { kategoriProduk, produkSeed } from "../data/produk.data";
import type { Produk } from "../types";
import { HttpError } from "../utils/httpError";

let produkList: Produk[] = structuredClone(produkSeed);

export interface ProdukFilter {
  q?: string;
  kategori?: string;
  toko?: string;
}

export const produkService = {
  findAll(filter: ProdukFilter = {}): Produk[] {
    const keyword = filter.q?.trim().toLowerCase();
    return produkList.filter((produk) => {
      const cocokKeyword =
        !keyword || [produk.nama, produk.sku].some((field) => field.toLowerCase().includes(keyword));
      const cocokKategori = !filter.kategori || produk.kategori === filter.kategori;
      const cocokToko = !filter.toko || produk.toko.nama === filter.toko;
      return cocokKeyword && cocokKategori && cocokToko;
    });
  },

  kategori() {
    return kategoriProduk;
  },

  ringkasan() {
    return { totalKoleksi: 142, pengrajin: 28, stokTersedia: 118, preOrder: 24, suhuBakar: "1.240°C" };
  },

  remove(id: number): void {
    if (!produkList.some((produk) => produk.id === id)) {
      throw new HttpError(404, "Produk tidak ditemukan");
    }
    produkList = produkList.filter((produk) => produk.id !== id);
  },
};

import type { Produk, Toko } from "../types";
import { produkTambahan, tokoTambahan } from "./katalog-tambahan.data";
import { produkSeed } from "./produk.data";
import { tokoSeed } from "./toko.data";

/**
 * Katalog demo lengkap = data awal (6 toko, 4 produk) + data tambahan (10 toko, 40 produk).
 * `jumlahProduk` setiap toko dihitung dari produk yang benar-benar ada, bukan angka karangan.
 */
const tokoBaruSementara = tokoTambahan(tokoSeed.length + 1, new Map());
const produkBaru = produkTambahan(produkSeed.length + 1, [...tokoSeed, ...tokoBaruSementara]);

export const semuaProduk: Produk[] = [...produkSeed, ...produkBaru];

const jumlahPerSlug = new Map<string, number>();
for (const produk of semuaProduk) jumlahPerSlug.set(produk.tokoSlug, (jumlahPerSlug.get(produk.tokoSlug) ?? 0) + 1);

export const semuaToko: Toko[] = [...tokoSeed, ...tokoTambahan(tokoSeed.length + 1, jumlahPerSlug)].map((toko) => ({
  ...toko,
  jumlahProduk: jumlahPerSlug.get(toko.slug) ?? 0,
}));

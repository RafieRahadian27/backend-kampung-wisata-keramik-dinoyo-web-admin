/**
 * Generator DATA SIMULASI untuk statistik kunjungan.
 *
 * Belum ada tabel pelacakan kunjungan/klik WhatsApp. Agar dashboard & laporan pengrajin tetap
 * bisa didemokan, angka dibangkitkan secara deterministik dari ID toko/produk (stabil setiap
 * muat ulang, berbeda antar toko). Setiap respons yang memakainya menyertakan
 * `sumber: "simulasi"` sehingga UI wajib menandainya. Ganti modul ini dengan query sungguhan
 * begitu pelacakan aktif — bentuk keluarannya sengaja dibuat sama.
 */

/** PRNG kecil (mulberry32): seed yang sama → deret angka yang sama. */
export function acak(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const antara = (rand: () => number, min: number, max: number) => Math.round(min + rand() * (max - min));

export const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"] as const;

/** Bobot hari: akhir pekan jauh lebih ramai (pola wisata edukasi Dinoyo). */
const BOBOT_HARI = [0.8, 0.75, 0.85, 0.9, 1.0, 1.65, 1.55];

export interface TokoSeed {
  id: number;
  jumlahProduk: number;
}

/** Kunjungan harian dasar sebuah toko (dipengaruhi jumlah produk di katalog). */
export function kunjunganHarian(toko: TokoSeed) {
  const rand = acak(toko.id * 7919);
  return antara(rand, 4, 9) * (1 + Math.min(toko.jumlahProduk, 60) / 30);
}

/** Deret 7 hari terakhir (Sen–Min) untuk semua toko pengguna. */
export function seriTujuhHari(toko: TokoSeed[]) {
  const dasar = toko.reduce((sum, item) => sum + kunjunganHarian(item), 0);
  const rand = acak(toko.reduce((sum, item) => sum + item.id, 7) * 92821);
  return HARI.map((hari, index) => {
    const kunjungan = Math.round(dasar * BOBOT_HARI[index] * (0.85 + rand() * 0.3));
    return { hari, kunjungan, klikWhatsapp: Math.round(kunjungan * (0.2 + rand() * 0.1)) };
  });
}

/** Persentase yang dijamin berjumlah 100 dari daftar bobot. */
export function persenDariBobot<T extends { bobot: number }>(items: T[]) {
  const total = items.reduce((sum, item) => sum + item.bobot, 0) || 1;
  const hasil = items.map((item) => ({ ...item, persen: Math.round((item.bobot / total) * 100) }));
  const selisih = 100 - hasil.reduce((sum, item) => sum + item.persen, 0);
  if (hasil.length) hasil[0].persen += selisih;
  return hasil.map(({ bobot: _bobot, ...rest }) => rest);
}

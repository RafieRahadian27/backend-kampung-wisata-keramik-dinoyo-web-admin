import { prisma } from "../lib/prisma";
import { produkRepository } from "../repositories/produk.repository";
import { tokoRepository } from "../repositories/toko.repository";
import type { AdminUser } from "../types";
import { acak, antara, HARI, kunjunganHarian, persenDariBobot } from "./simulasi";

/**
 * Laporan kunjungan per toko untuk pengrajin.
 *
 * Belum ada tabel pelacakan kunjungan/klik, sehingga angka kunjungan masih DATA SIMULASI
 * (lihat services/simulasi.ts) — stabil setiap muat ulang dan hanya mencakup toko milik
 * pengguna. Respons menyertakan `sumber: "simulasi"` agar UI menandainya dengan jelas.
 * Daftar toko, produk, dan harganya adalah data asli dari database.
 */

export type PeriodeLaporan = 7 | 30 | 90;
export const PERIODE_LAPORAN: readonly PeriodeLaporan[] = [7, 30, 90];

const LABEL_PERIODE: Record<PeriodeLaporan, string> = { 7: "7 hari terakhir", 30: "30 hari terakhir", 90: "90 hari terakhir" };

/** Pembagian sumbu waktu grafik tren per periode. */
const BUCKET: Record<PeriodeLaporan, { label: string[]; hari: number }> = {
  7: { label: [...HARI], hari: 1 },
  30: { label: ["Mg 1", "Mg 2", "Mg 3", "Mg 4", "Mg 5"], hari: 6 },
  90: { label: ["Mg 1–2", "Mg 3–4", "Mg 5–6", "Mg 7–8", "Mg 9–10", "Mg 11–13"], hari: 15 },
};

const PEMESAN = [
  { nama: "SDN Dinoyo 2 Malang", peserta: 32, jenis: "Sekolah", paket: "Edukasi Sekolah (Bisque)", tarif: 30000 },
  { nama: "Keluarga Bapak Hendra", peserta: 5, jenis: "Keluarga", paket: "Ceramic Painting", tarif: 45000 },
  { nama: "Komunitas Kriya Batu", peserta: 12, jenis: "Komunitas", paket: "Teknik Putar (Wheel)", tarif: 85000 },
  { nama: "Mahasiswa DKV Universitas Negeri Malang", peserta: 20, jenis: "Kampus", paket: "Glasir & Pembakaran", tarif: 60000 },
  { nama: "Rombongan Wisata Jakarta", peserta: 8, jenis: "Wisatawan", paket: "Ceramic Painting", tarif: 45000 },
  { nama: "TK Alam Ar-Rohmah", peserta: 25, jenis: "Sekolah", paket: "Mewarnai Celengan", tarif: 25000 },
];

const ULASAN = [
  { nama: "Rina A.", asal: "Surabaya", teks: "Pengrajinnya ramah, anak-anak senang belajar memutar tanah liat. Hasil karyanya bisa dibawa pulang!" },
  { nama: "Dimas P.", asal: "Malang", teks: "Pilihan vas dan cangkirnya rapi, harga masuk akal untuk kualitas glasirnya." },
  { nama: "Mrs. Helen", asal: "Australia", teks: "Lovely studio, authentic process. The owner explained every step of firing." },
  { nama: "Yusuf H.", asal: "Jakarta", teks: "Pesan suvenir pernikahan 200 pcs, selesai tepat waktu dan dikemas aman." },
];

export const laporanTokoService = {
  async laporan(user: AdminUser, periode: PeriodeLaporan = 30) {
    const [toko, produk] = await Promise.all([tokoRepository.findMany(prisma, user), produkRepository.findMany(prisma, user)]);
    const bucket = BUCKET[periode];
    const faktor = periode / 30;

    const perToko = toko.map((item) => {
      const rand = acak(item.id * 7919 + periode);
      const kunjungan = Math.round(kunjunganHarian(item) * periode * (0.9 + rand() * 0.2));
      const klikWhatsapp = Math.round(kunjungan * (0.18 + rand() * 0.12));
      return {
        slug: item.slug,
        nama: item.nama,
        lokasiGang: item.lokasiGang,
        kunjungan,
        klikWhatsapp,
        reservasi: Math.max(1, Math.round(antara(rand, 2, 9) * faktor)),
        pertumbuhan: Math.round((rand() * 30 - 6) * 10) / 10,
      };
    });

    const total = (key: "kunjungan" | "klikWhatsapp" | "reservasi") => perToko.reduce((sum, item) => sum + item[key], 0);
    const totalKunjungan = total("kunjungan");
    const totalKlik = total("klikWhatsapp");
    const totalReservasi = total("reservasi");
    const seed = toko.reduce((sum, item) => sum + item.id, 1) * 104729 + periode;
    const rand = acak(seed);

    // Tren: bagi total kunjungan ke tiap bucket dengan bobot acak + lonjakan akhir pekan.
    const bobotTren = bucket.label.map((_, index) => (periode === 7 && index >= 5 ? 1.6 : 1) * (0.75 + rand() * 0.5));
    const sumBobot = bobotTren.reduce((sum, value) => sum + value, 0);
    const rasioKlik = totalKunjungan ? totalKlik / totalKunjungan : 0;
    const tren = bucket.label.map((label, index) => {
      const kunjungan = Math.round((totalKunjungan * bobotTren[index]) / sumBobot);
      return { label, kunjungan, klikWhatsapp: Math.round(kunjungan * rasioKlik * (0.9 + rand() * 0.2)) };
    });

    // Peta jam ramai (hari × slot jam) dalam skala 0–100.
    const SLOT = ["08–10", "10–12", "12–14", "14–16", "16–18"];
    const bobotSlot = [0.55, 1, 0.8, 0.9, 0.5];
    const bobotHari = [0.55, 0.5, 0.6, 0.62, 0.7, 1, 0.95];
    const jamRamai = {
      slot: SLOT,
      baris: HARI.map((hari, h) => ({
        hari,
        nilai: SLOT.map((_, s) => Math.min(100, Math.round(bobotHari[h] * bobotSlot[s] * (78 + rand() * 30)))),
      })),
    };

    const produkPopuler = produk
      .map((item) => {
        const r = acak(item.id * 15485863 + periode);
        const dilihat = Math.round(antara(r, 40, 420) * faktor);
        const tanyaWhatsapp = Math.round(dilihat * (0.08 + r() * 0.1));
        return { id: item.id, nama: item.nama, foto: item.foto, kategori: item.kategori, harga: item.harga, dilihat, tanyaWhatsapp };
      })
      .sort((a, b) => b.dilihat - a.dilihat)
      .slice(0, 5);

    const totalDilihat = produkPopuler.reduce((sum, item) => sum + item.dilihat, 0);
    const transaksi = Math.round(totalKlik * (0.32 + rand() * 0.1));
    const rataHarga = produk.length ? produk.reduce((sum, item) => sum + item.harga, 0) / produk.length : 0;

    const randReservasi = acak(user.id * 31337 + periode);
    const reservasi = toko.length
      ? PEMESAN.map((pemesan, index) => {
          const tokoTujuan = toko[index % toko.length];
          const hariKe = antara(randReservasi, 1, 28);
          return {
            id: `#RS-${String(tokoTujuan.id).padStart(2, "0")}${String(index + 1).padStart(2, "0")}`,
            pemesan: pemesan.nama,
            detail: `${pemesan.peserta} peserta • ${pemesan.jenis}`,
            paket: pemesan.paket,
            toko: tokoTujuan.nama,
            tanggal: `${hariKe} ${index < 3 ? "Nov" : "Des"} 2026`,
            jam: ["09:00", "10:30", "13:00", "14:30"][index % 4] + " WIB",
            nilai: pemesan.peserta * pemesan.tarif,
            status: index < 2 ? "selesai" : index === PEMESAN.length - 1 ? "menunggu" : "terjadwal",
          };
        })
      : [];

    const randUlasan = acak(seed * 3);
    const ulasan = toko.length ? ULASAN.map((item, index) => ({ ...item, rating: index === 1 ? 4 : 5, tanggal: `${antara(randUlasan, 1, 28)} Nov 2026` })) : [];
    const konversi = totalKunjungan ? Math.round((totalKlik / totalKunjungan) * 1000) / 10 : 0;
    const pertumbuhan = perToko.length ? Math.round((perToko.reduce((sum, item) => sum + item.pertumbuhan, 0) / perToko.length) * 10) / 10 : 0;

    return {
      sumber: "simulasi" as const,
      periode,
      periodeLabel: LABEL_PERIODE[periode],
      ringkasan: {
        kunjungan: { nilai: totalKunjungan, pertumbuhan, rataHarian: Math.round(totalKunjungan / periode) },
        klikWhatsapp: { nilai: totalKlik, konversi },
        reservasi: { nilai: totalReservasi, peserta: reservasi.reduce((sum, item) => sum + Number(item.detail.split(" ")[0]), 0) },
        produkDilihat: { nilai: totalDilihat },
        transaksi: { nilai: transaksi, estimasiOmzet: Math.round(transaksi * rataHarga * 1.4) },
        rating: { nilai: toko.length ? 4.8 : 0, ulasan: toko.length ? Math.round(antara(rand, 14, 40) * faktor) + 6 : 0 },
      },
      tren,
      jamRamai,
      corong: [
        { tahap: "Melihat profil toko", nilai: Math.round(totalKunjungan * 3.1) },
        { tahap: "Membuka detail produk", nilai: Math.round(totalKunjungan * 1.4) },
        { tahap: "Datang / berkunjung", nilai: totalKunjungan },
        { tahap: "Klik WhatsApp", nilai: totalKlik },
        { tahap: "Transaksi / reservasi", nilai: transaksi + totalReservasi },
      ],
      sumberPengunjung: persenDariBobot([
        { nama: "Direktori Kampung Dinoyo", bobot: 34 + rand() * 8 },
        { nama: "Google Maps", bobot: 24 + rand() * 6 },
        { nama: "Instagram & TikTok", bobot: 16 + rand() * 6 },
        { nama: "Datang langsung", bobot: 12 + rand() * 4 },
        { nama: "Agen & biro wisata", bobot: 6 + rand() * 4 },
      ]),
      asalPengunjung: persenDariBobot([
        { nama: "Malang Raya", bobot: 38 + rand() * 6 },
        { nama: "Surabaya & Sidoarjo", bobot: 22 + rand() * 5 },
        { nama: "Jabodetabek", bobot: 14 + rand() * 4 },
        { nama: "Kota lain di Jawa", bobot: 12 + rand() * 4 },
        { nama: "Luar Jawa", bobot: 6 + rand() * 3 },
        { nama: "Mancanegara", bobot: 3 + rand() * 3 },
      ]),
      banding: {
        konversiToko: konversi,
        konversiSentra: 21.4,
        kunjunganHarianToko: Math.round(totalKunjungan / periode),
        kunjunganHarianSentra: 14,
        ratingToko: toko.length ? 4.8 : 0,
        ratingSentra: 4.6,
      },
      perToko,
      produkPopuler,
      reservasi,
      ulasan,
    };
  },
};

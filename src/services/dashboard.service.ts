import { adminUser } from "../data/akun.data";
import { tokoService } from "./toko.service";

export const dashboardService = {
  ringkasan() {
    return {
      admin: adminUser,
      tanggal: "Senin, 24 Oktober 2024",
      statistik: {
        toko: { nilai: 28, catatan: "2 menunggu verifikasi berkas", lencana: "+2 baru" },
        produk: { nilai: 142, catatan: "Tersebar di 4 kategori utama (Pecah Belah, Hiasan, Souvenir, Pot)", lencana: "Aktif 100%" },
        pengrajin: { nilai: 34, catatan: "Aktif mengelola etalase & reservasi mandiri", lencana: "Terverifikasi" },
        reservasi: { nilai: 18, catatan: "7 kelas teknik putar & 11 kelas mewarnai", lencana: "Minggu Ini" },
      },
      verifikasi: {
        pengajuan: tokoService.pengajuan(),
        terakhirDisetujui: {
          nama: "Keramik Barokah Jaya",
          catatan: "Diverifikasi oleh Pak Joko pada 22 Okt 2024",
        },
        totalPendaftarTahunIni: 30,
      },
      whatsapp: {
        totalKlik: 1480,
        pertumbuhan: 18.4,
        harian: [
          { hari: "Sen", nilai: 45 },
          { hari: "Sel", nilai: 60 },
          { hari: "Rab", nilai: 38 },
          { hari: "Kam", nilai: 65, sorot: "secondary" },
          { hari: "Jum", nilai: 52 },
          { hari: "Sab", nilai: 70, sorot: "primary" },
          { hari: "Min", nilai: 58 },
        ],
        gang: [
          { nama: "Gang 2 (Pusat Souvenir Dinoyo)", klik: 542, persen: 58, tone: "primary" },
          { nama: "Gang 4 (Sentra Vas & Guci Besar)", klik: 389, persen: 34, tone: "secondary" },
        ],
      },
      kelasAkhirPekan: {
        judul: "Kelas Keramik Akhir Pekan",
        catatan: "Slot terisi 85% untuk Sabtu & Minggu ini",
      },
    };
  },
};

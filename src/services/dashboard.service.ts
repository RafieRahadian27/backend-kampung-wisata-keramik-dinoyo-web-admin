import { prisma } from "../lib/prisma";
import { auditRepository } from "../repositories/audit.repository";
import { pengajuanService } from "./pengajuan.service";
import { produkRepository } from "../repositories/produk.repository";
import { tokoRepository } from "../repositories/toko.repository";
import type { AdminUser } from "../types";
import { akunService } from "./akun.service";

const formatTanggal = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", ...options }).format(date);

export const dashboardService = {
  async ringkasan(admin: AdminUser) {
    /**
     * Asynchronous I/O: enam query independen dikirim BERSAMAAN lewat Promise.all.
     * Masing-masing meminjam koneksi berbeda dari prisma, sehingga total waktu tunggu
     * ≈ query paling lambat, bukan jumlah semuanya (seperti bila di-await satu per satu).
     */
    const [toko, produk, kategori, akun, pengajuan, terakhir, whatsappClicks] = await Promise.all([
      tokoRepository.ringkasan(prisma, admin),
      produkRepository.ringkasan(prisma, admin),
      produkRepository.kategori(prisma, admin),
      akunService.ringkasan(),
      pengajuanService.findAll(),
      auditRepository.latest(prisma, "pengajuan:verifikasi"),
      prisma.auditLog.findMany({ where: { aksi: "whatsapp:klik", createdAt: { gte: new Date(Date.now() - 7 * 86400000) } }, orderBy: { createdAt: "asc" } }),
    ]);

    return {
      admin,
      tanggal: formatTanggal(new Date(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      statistik: {
        toko: { nilai: toko.total, catatan: `${toko.menunggu} menunggu verifikasi berkas`, lencana: `+${pengajuan.filter((p) => p.status === "menunggu").length} baru` },
        produk: {
          nilai: produk.totalKoleksi,
          catatan: `Tersebar di ${kategori.length} kategori utama (${kategori.map((k) => k.nama).join(", ")})`,
          lencana: `${produk.stokTersedia} tersedia`,
        },
        pengrajin: { nilai: akun.total, catatan: `${akun.aktif} aktif mengelola etalase toko`, lencana: "Terverifikasi" },
         reservasi: { nilai: 0, catatan: "Data reservasi tidak disimpan", lencana: "WhatsApp" },
      },
      verifikasi: {
        pengajuan,
        terakhirDisetujui: terakhir
          ? {
              nama: terakhir.target,
              catatan: `Diverifikasi oleh ${terakhir.oleh ?? "admin"} pada ${formatTanggal(terakhir.createdAt, { day: "numeric", month: "short", year: "numeric" })}`,
            }
          : { nama: "Keramik Barokah Jaya", catatan: "Diverifikasi oleh Pak Joko pada 22 Okt 2024" },
        totalPendaftarTahunIni: 30,
      },
      whatsapp: {
        totalKlik: whatsappClicks.length,
        pertumbuhan: 0,
        harian: Array.from({ length: 7 }, (_, index) => {
          const date = new Date(Date.now() - (6 - index) * 86400000);
          return { hari: formatTanggal(date, { weekday: "short" }), nilai: whatsappClicks.filter((click) => click.createdAt.toDateString() === date.toDateString()).length };
        }),
        gang: [],
      },
      kelasAkhirPekan: {
        judul: "Kelas Keramik Akhir Pekan",
        catatan: "Slot terisi 85% untuk Sabtu & Minggu ini",
      },
    };
  },
};

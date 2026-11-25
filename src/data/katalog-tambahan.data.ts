import type { Produk, StatusProduk, Toko } from "../types";

/**
 * Data demo TAMBAHAN agar direktori toko & katalog produk terasa seperti sentra sungguhan
 * (16 toko, 44 produk). Semua nilai lolos validasi terbaru: nama pengrajin hanya huruf, nama produk
 * tanpa angka, WhatsApp hanya digit (08/62…), koordinat di sekitar Kelurahan Dinoyo, teknik dari
 * daftar resmi. Foto memakai aset bawaan di frontend/public/images (diputar bergiliran).
 *
 * Dipakai oleh:
 *  - prisma/seed.ts          → `npm run db:seed` / `db:reset` (data dihapus lalu diisi ulang)
 *  - prisma/seed-katalog.ts  → `npm run db:katalog` (HANYA menambah yang belum ada, data lain aman)
 */

const FOTO_TOKO = [
  "/images/toko-galeri-porselen.jpg",
  "/images/toko-rumah-kriya.jpg",
  "/images/toko-sanggar-ibu-sri.jpg",
  "/images/toko-sari-asih.jpg",
  "/images/toko-suvenir-melati.jpg",
  "/images/toko-tiga-putra.jpg",
  "/images/sampul-galeri.jpg",
];
const FOTO_PRODUK: Record<string, string[]> = {
  "Tableware & Cangkir": ["/images/produk-cangkir-celadon.jpg", "/images/produk-piring-terakota.jpg"],
  "Vas Bunga & Guci": ["/images/produk-vas-wabi-sabi.jpg", "/images/produk-guci-pusaka.jpg"],
  Aromaterapi: ["/images/produk-vas-wabi-sabi.jpg", "/images/produk-cangkir-celadon.jpg"],
  "Souvenir & Custom": ["/images/produk-piring-terakota.jpg", "/images/produk-guci-pusaka.jpg"],
};

const WILAYAH = [
  "Jl. MT Haryono Gg. IX (Sentra Pembakaran Putar)",
  "Gg. X (Gerabah Alami & Tungku)",
  "Gg. II & IV (Suvenir & Custom)",
  "Koridor Jl. MT Haryono (Depan)",
];

interface TokoBaru {
  slug: string;
  nama: string;
  pemilik: string;
  whatsapp: string;
  lokasiGang: string;
  wilayah: number;
  koordinat: string;
  spesialisasi: string;
  kategori: string[];
  tahunBerdiri: number;
  jamBuka: string;
  status: Toko["status"];
  badge?: Toko["badge"];
  akreditasi: boolean;
  deskripsi: string;
}

const TOKO_BARU: TokoBaru[] = [
  { slug: "keramik-cahaya-dinoyo", nama: "Keramik Cahaya Dinoyo", pemilik: "Ibu Endang Lestari", whatsapp: "081233419901", lokasiGang: "Gg. IX No. 08", wilayah: 0, koordinat: "-7.9418, 112.6083", spesialisasi: "Semi-Porselen", kategori: ["Semi-Porselen", "Tableware Kafe"], tahunBerdiri: 1991, jamBuka: "Senin - Minggu, 09.00 - 17.00", status: "terverifikasi", badge: "unggulan", akreditasi: true, deskripsi: "Spesialis tableware semi-porselen untuk kafe dan hotel di Malang Raya, dengan glasir warna tanah yang dibakar 1200°C." },
  { slug: "sanggar-tanah-liat-mbah-karto", nama: "Sanggar Tanah Liat Mbah Karto", pemilik: "Mbah Kartorejo", whatsapp: "085233102277", lokasiGang: "Gg. X No. 03", wilayah: 1, koordinat: "-7.9436, 112.6076", spesialisasi: "Gerabah Alami", kategori: ["Gerabah Alami", "Edukasi Workshop"], tahunBerdiri: 1958, jamBuka: "Senin - Sabtu, 08.00 - 16.00", status: "terverifikasi", badge: "maestro", akreditasi: true, deskripsi: "Sanggar tertua di Gang X yang masih memakai tungku kayu tradisional. Membuka kelas putar tanah liat untuk rombongan sekolah." },
  { slug: "rumah-glasir-anugerah", nama: "Rumah Glasir Anugerah", pemilik: "Danu Prasetyo", whatsapp: "087812349090", lokasiGang: "Gg. IX No. 27", wilayah: 0, koordinat: "-7.9423, 112.6094", spesialisasi: "Custom & Art", kategori: ["Guci & Hiasan", "Semi-Porselen"], tahunBerdiri: 2008, jamBuka: "Senin - Minggu, 09.00 - 17.00", status: "terverifikasi", akreditasi: true, deskripsi: "Studio eksperimen glasir reaktif dan raku. Menerima pesanan karya seni keramik untuk interior dan galeri." },
  { slug: "gerabah-sumber-rejeki", nama: "Gerabah Sumber Rejeki", pemilik: "Bapak Supriyadi", whatsapp: "081398760011", lokasiGang: "Gg. X No. 15", wilayah: 1, koordinat: "-7.9439, 112.6081", spesialisasi: "Gerabah Alami", kategori: ["Gerabah Alami", "Guci & Hiasan"], tahunBerdiri: 1979, jamBuka: "Senin - Sabtu, 08.00 - 16.00", status: "terverifikasi", akreditasi: false, deskripsi: "Produsen pot tanaman, kendi, dan celengan gerabah bakar rendah untuk pasar grosir Jawa Timur." },
  { slug: "suvenir-keramik-kencana", nama: "Suvenir Keramik Kencana", pemilik: "Ibu Wulan Sari", whatsapp: "082245678812", lokasiGang: "Gg. II No. 19", wilayah: 2, koordinat: "-7.9412, 112.6099", spesialisasi: "Custom & Art", kategori: ["Guci & Hiasan", "Edukasi Workshop"], tahunBerdiri: 2012, jamBuka: "Senin - Minggu, 09.00 - 17.00", status: "terverifikasi", badge: "baru", akreditasi: true, deskripsi: "Suvenir pernikahan dan cendera mata instansi dengan cetak logo, pengerjaan cepat untuk pesanan ratusan buah." },
  { slug: "studio-putar-arjuna", nama: "Studio Putar Arjuna", pemilik: "Arjuna Wicaksana", whatsapp: "089611223344", lokasiGang: "Gg. IV No. 06", wilayah: 2, koordinat: "-7.9408, 112.6104", spesialisasi: "Semi-Porselen", kategori: ["Tableware Kafe", "Edukasi Workshop"], tahunBerdiri: 2016, jamBuka: "Sabtu - Minggu, 09.00 - 15.00", status: "menunggu", akreditasi: false, deskripsi: "Studio muda yang fokus pada kelas putar akhir pekan dan perlengkapan seduh kopi handmade." },
  { slug: "galeri-kriya-pandanwangi", nama: "Galeri Kriya Pandanwangi", pemilik: "Hj. Siti Rohmah", whatsapp: "081311557799", lokasiGang: "Jl. MT Haryono No. 88", wilayah: 3, koordinat: "-7.9402, 112.6089", spesialisasi: "Semi-Porselen", kategori: ["Semi-Porselen", "Guci & Hiasan", "Tableware Kafe"], tahunBerdiri: 1988, jamBuka: "Senin - Minggu, 09.00 - 17.00", status: "terverifikasi", badge: "unggulan", akreditasi: true, deskripsi: "Galeri besar di koridor depan dengan ruang pamer dua lantai, menjadi titik singgah utama bus wisata." },
  { slug: "keramik-lumbung-tani", nama: "Keramik Lumbung Tani", pemilik: "Teguh Santoso", whatsapp: "085755443322", lokasiGang: "Gg. X No. 22", wilayah: 1, koordinat: "-7.9441, 112.6085", spesialisasi: "Gerabah Alami", kategori: ["Gerabah Alami"], tahunBerdiri: 1999, jamBuka: "Senin - Sabtu, 08.00 - 16.00", status: "nonaktif", akreditasi: false, deskripsi: "Sedang renovasi tungku. Sebelumnya memproduksi gentong air dan peralatan dapur tanah liat." },
  { slug: "omah-keramik-larasati", nama: "Omah Keramik Larasati", pemilik: "Ibu Larasati Dewi", whatsapp: "081277889900", lokasiGang: "Gg. IX No. 51", wilayah: 0, koordinat: "-7.9427, 112.6079", spesialisasi: "Custom & Art", kategori: ["Guci & Hiasan", "Tableware Kafe"], tahunBerdiri: 2005, jamBuka: "Senin - Minggu, 09.00 - 17.00", status: "terverifikasi", akreditasi: true, deskripsi: "Dikenal dengan motif batik Malangan yang dilukis tangan pada piring dan vas porselen." },
  { slug: "aroma-tanah-dinoyo", nama: "Aroma Tanah Dinoyo", pemilik: "Rizky Ananda", whatsapp: "087755664411", lokasiGang: "Gg. II No. 04", wilayah: 2, koordinat: "-7.9415, 112.6102", spesialisasi: "Custom & Art", kategori: ["Guci & Hiasan"], tahunBerdiri: 2019, jamBuka: "Senin - Minggu, 10.00 - 18.00", status: "menunggu", badge: "baru", akreditasi: false, deskripsi: "Tungku aromaterapi dan diffuser keramik dengan wangi rempah lokal, dijual juga secara daring." },
];

const inisial = (nama: string) =>
  nama
    .split(/\s+/)
    .filter((kata) => /^\p{Lu}/u.test(kata))
    .slice(0, 2)
    .map((kata) => kata[0])
    .join("");

interface ProdukBaru {
  nama: string;
  kategori: string;
  teknik: string;
  bahan: string;
  harga: number;
  status: StatusProduk;
  stok: number;
  badge?: string;
}

/** 40 produk baru; dibagikan bergiliran ke semua toko (lihat `produkTambahan`). */
const PRODUK_BARU: ProdukBaru[] = [
  { nama: "Mug Kopi Glasir Hijau Lumut", kategori: "Tableware & Cangkir", teknik: "Putar Tangan", bahan: "High-fired Stoneware", harga: 75000, status: "tersedia", stok: 36 },
  { nama: "Set Cangkir Teh Bunga Kenanga", kategori: "Tableware & Cangkir", teknik: "Lukis Tangan Halus", bahan: "Porselen Halus", harga: 320000, status: "tersedia", stok: 10, badge: "Best Seller" },
  { nama: "Piring Makan Speckled Putih", kategori: "Tableware & Cangkir", teknik: "Putar Tangan", bahan: "High-fired Stoneware", harga: 95000, status: "tersedia", stok: 40 },
  { nama: "Mangkuk Ramen Biru Kobalt", kategori: "Tableware & Cangkir", teknik: "Putar Tangan", bahan: "Semi-Porselen", harga: 110000, status: "tersedia", stok: 24 },
  { nama: "Teko Seduh Kopi Pour Over", kategori: "Tableware & Cangkir", teknik: "Putar Tangan", bahan: "High-fired Stoneware", harga: 210000, status: "preorder", stok: 6 },
  { nama: "Piring Batik Malangan", kategori: "Tableware & Cangkir", teknik: "Lukis Tangan Halus", bahan: "Porselen Halus", harga: 185000, status: "tersedia", stok: 14, badge: "Edisi Terbatas" },
  { nama: "Cawan Saus Mini Terakota", kategori: "Tableware & Cangkir", teknik: "Pinching", bahan: "Terakota Lokal", harga: 25000, status: "tersedia", stok: 120 },
  { nama: "Gelas Bambu Tekstur Kasar", kategori: "Tableware & Cangkir", teknik: "Slab Building", bahan: "Earthenware Granular", harga: 55000, status: "habis", stok: 0 },
  { nama: "Mangkuk Salad Kayu Manis", kategori: "Tableware & Cangkir", teknik: "Putar Tangan", bahan: "Semi-Porselen", harga: 130000, status: "tersedia", stok: 18 },
  { nama: "Nampan Saji Persegi Rustic", kategori: "Tableware & Cangkir", teknik: "Slab Building", bahan: "Terakota Lokal", harga: 145000, status: "tersedia", stok: 9 },
  { nama: "Cangkir Espresso Hitam Doff", kategori: "Tableware & Cangkir", teknik: "Cetak Tuang (Slip Casting)", bahan: "Semi-Porselen", harga: 45000, status: "tersedia", stok: 60 },
  { nama: "Set Piring Sarapan Pastel", kategori: "Tableware & Cangkir", teknik: "Cetak Tekan (Press Mold)", bahan: "Semi-Porselen", harga: 260000, status: "preorder", stok: 5 },
  { nama: "Vas Tinggi Retak Seribu", kategori: "Vas Bunga & Guci", teknik: "Putar Tangan", bahan: "Porselen Halus", harga: 450000, status: "tersedia", stok: 4, badge: "Karya Maestro" },
  { nama: "Guci Naga Emas", kategori: "Vas Bunga & Guci", teknik: "Ukir Manual", bahan: "Porselen Halus", harga: 2750000, status: "preorder", stok: 2, badge: "Karya Maestro" },
  { nama: "Vas Bulat Glasir Raku", kategori: "Vas Bunga & Guci", teknik: "Glasir Celup", bahan: "High-fired Stoneware", harga: 380000, status: "tersedia", stok: 7 },
  { nama: "Pot Tanaman Gantung Minimalis", kategori: "Vas Bunga & Guci", teknik: "Putar Tangan", bahan: "Terakota Lokal", harga: 65000, status: "tersedia", stok: 55 },
  { nama: "Kendi Air Tradisional", kategori: "Vas Bunga & Guci", teknik: "Putar Tangan", bahan: "Earthenware Granular", harga: 85000, status: "tersedia", stok: 30 },
  { nama: "Vas Botol Leher Panjang", kategori: "Vas Bunga & Guci", teknik: "Putar Tangan", bahan: "Semi-Porselen", harga: 175000, status: "tersedia", stok: 12 },
  { nama: "Guci Ukir Relief Candi", kategori: "Vas Bunga & Guci", teknik: "Cetak Padat & Ukir Tangan", bahan: "Terakota Lokal", harga: 950000, status: "tersedia", stok: 3, badge: "Edisi Terbatas" },
  { nama: "Pot Sukulen Wajah Lucu", kategori: "Vas Bunga & Guci", teknik: "Pinching", bahan: "Terakota Lokal", harga: 35000, status: "tersedia", stok: 80, badge: "Baru" },
  { nama: "Vas Lantai Motif Bambu", kategori: "Vas Bunga & Guci", teknik: "Hand Built Coiling", bahan: "Earthenware Granular", harga: 690000, status: "habis", stok: 0 },
  { nama: "Gentong Hias Teras", kategori: "Vas Bunga & Guci", teknik: "Hand Built Coiling", bahan: "Terakota Lokal", harga: 520000, status: "preorder", stok: 4 },
  { nama: "Tungku Aromaterapi Lilin", kategori: "Aromaterapi", teknik: "Cetak Tuang (Slip Casting)", bahan: "Semi-Porselen", harga: 70000, status: "tersedia", stok: 45, badge: "Best Seller" },
  { nama: "Diffuser Batu Apung Keramik", kategori: "Aromaterapi", teknik: "Cetak Tekan (Press Mold)", bahan: "Earthenware Granular", harga: 90000, status: "tersedia", stok: 26 },
  { nama: "Tempat Dupa Daun Jati", kategori: "Aromaterapi", teknik: "Slab Building", bahan: "Terakota Lokal", harga: 40000, status: "tersedia", stok: 64 },
  { nama: "Burner Minyak Atsiri Kubah", kategori: "Aromaterapi", teknik: "Putar Tangan", bahan: "High-fired Stoneware", harga: 115000, status: "tersedia", stok: 15 },
  { nama: "Lilin Aroma Wadah Keramik", kategori: "Aromaterapi", teknik: "Putar Tangan", bahan: "Semi-Porselen", harga: 125000, status: "preorder", stok: 8, badge: "Baru" },
  { nama: "Diffuser Rotan Pot Mini", kategori: "Aromaterapi", teknik: "Pinching", bahan: "Terakota Lokal", harga: 60000, status: "habis", stok: 0 },
  { nama: "Tungku Rempah Ukir Bunga", kategori: "Aromaterapi", teknik: "Ukir Manual", bahan: "Terakota Lokal", harga: 150000, status: "tersedia", stok: 11 },
  { nama: "Wadah Garam Mandi Rustic", kategori: "Aromaterapi", teknik: "Glasir Celup", bahan: "High-fired Stoneware", harga: 80000, status: "tersedia", stok: 22 },
  { nama: "Gantungan Kunci Mini Vas", kategori: "Souvenir & Custom", teknik: "Cetak Tekan (Press Mold)", bahan: "Terakota Lokal", harga: 15000, status: "tersedia", stok: 300 },
  { nama: "Magnet Kulkas Tugu Malang", kategori: "Souvenir & Custom", teknik: "Cetak Tekan (Press Mold)", bahan: "Earthenware Granular", harga: 20000, status: "tersedia", stok: 250, badge: "Best Seller" },
  { nama: "Celengan Ayam Jago", kategori: "Souvenir & Custom", teknik: "Cetak Padat & Ukir Tangan", bahan: "Terakota Lokal", harga: 45000, status: "tersedia", stok: 70 },
  { nama: "Plakat Logo Instansi Custom", kategori: "Souvenir & Custom", teknik: "Ukir Manual", bahan: "Porselen Halus", harga: 350000, status: "preorder", stok: 20 },
  { nama: "Miniatur Tungku Kampung Dinoyo", kategori: "Souvenir & Custom", teknik: "Hand Built Coiling", bahan: "Terakota Lokal", harga: 95000, status: "tersedia", stok: 16, badge: "Edisi Terbatas" },
  { nama: "Suvenir Pernikahan Cangkir Mini", kategori: "Souvenir & Custom", teknik: "Cetak Tuang (Slip Casting)", bahan: "Semi-Porselen", harga: 12000, status: "preorder", stok: 500 },
  { nama: "Hiasan Dinding Topeng Malangan", kategori: "Souvenir & Custom", teknik: "Cetak Padat & Ukir Tangan", bahan: "Earthenware Granular", harga: 175000, status: "tersedia", stok: 9 },
  { nama: "Pin Bros Glasir Warna Warni", kategori: "Souvenir & Custom", teknik: "Glasir Celup", bahan: "Semi-Porselen", harga: 25000, status: "tersedia", stok: 140 },
  { nama: "Asbak Kayu Jati Keramik", kategori: "Souvenir & Custom", teknik: "Slab Building", bahan: "High-fired Stoneware", harga: 55000, status: "habis", stok: 0 },
  { nama: "Kotak Perhiasan Ukir Mawar", kategori: "Souvenir & Custom", teknik: "Ukir Manual", bahan: "Porselen Halus", harga: 240000, status: "tersedia", stok: 6 },
];

const SINGKATAN: Record<string, string> = {
  "Tableware & Cangkir": "TBL",
  "Vas Bunga & Guci": "VAS",
  Aromaterapi: "ARM",
  "Souvenir & Custom": "SVN",
};
const LOKASI_STOK = ["Rak A Galeri", "Rak B Galeri", "Display Utama", "Gudang Belakang", "Etalase Kaca", "Rak Pajang Depan"];

function stokLabel(status: StatusProduk, stok: number): string {
  if (status === "habis") return "Stok Habis";
  if (status === "preorder") return `Pre-Order (${stok} slot)`;
  return `Tersedia (${stok} pcs)`;
}

/** 10 toko baru (id 7–16) dalam bentuk yang sama dengan tokoSeed. */
export function tokoTambahan(idAwal: number, jumlahProdukPerSlug: Map<string, number>): Toko[] {
  return TOKO_BARU.map((t, index) => ({
    id: idAwal + index,
    slug: t.slug,
    nama: t.nama,
    nib: String(91200100000 + index * 7919),
    keterangan: `Aktif sejak ${t.tahunBerdiri}`,
    pemilik: t.pemilik,
    whatsapp: t.whatsapp,
    lokasiGang: t.lokasiGang,
    wilayah: WILAYAH[t.wilayah],
    alamat: `${t.lokasiGang.startsWith("Jl.") ? t.lokasiGang : `Jl. MT Haryono ${t.lokasiGang}`}, Dinoyo, Lowokwaru`,
    koordinat: t.koordinat,
    spesialisasi: t.spesialisasi,
    kategori: t.kategori,
    jumlahProduk: jumlahProdukPerSlug.get(t.slug) ?? 0,
    tahunBerdiri: t.tahunBerdiri,
    deskripsi: t.deskripsi,
    jamBuka: t.jamBuka,
    status: t.status,
    badge: t.badge,
    foto: FOTO_TOKO[index % FOTO_TOKO.length],
    aktifPublik: t.status === "terverifikasi",
    akreditasi: t.akreditasi,
    diperbarui: new Date(Date.UTC(2026, 9, 1 + index, 3)).toISOString(),
  }));
}

/**
 * 40 produk baru, dibagikan bergiliran ke `semuaToko` (toko lama + baru, kecuali yang nonaktif),
 * sehingga setiap toko — termasuk toko akun demo pengrajin — punya beberapa produk.
 */
export function produkTambahan(idAwal: number, semuaToko: Pick<Toko, "slug" | "nama" | "pemilik" | "status">[]): Produk[] {
  const tokoAktif = semuaToko.filter((t) => t.status !== "nonaktif");
  const nomorPerKategori = new Map<string, number>();
  return PRODUK_BARU.map((p, index) => {
    const toko = tokoAktif[index % tokoAktif.length];
    const nomor = (nomorPerKategori.get(p.kategori) ?? 100) + 1;
    nomorPerKategori.set(p.kategori, nomor);
    const fotoKategori = FOTO_PRODUK[p.kategori];
    return {
      id: idAwal + index,
      nama: p.nama,
      // Huruf "K" (katalog demo) menjamin tidak bentrok dengan SKU buatan server (DNY-VAS-046: angka saja).
      sku: `DNY-${SINGKATAN[p.kategori]}-K${nomor}`,
      teknik: p.teknik,
      foto: fotoKategori[index % fotoKategori.length],
      badge: p.badge,
      tokoSlug: toko.slug,
      toko: { nama: toko.nama, inisial: inisial(toko.nama) || "DN", pengrajin: toko.pemilik },
      kategori: p.kategori,
      bahan: p.bahan,
      harga: p.harga,
      catatanHarga: "Margin Paguyuban 10%",
      status: p.status,
      stokLabel: stokLabel(p.status, p.stok),
      lokasiStok: LOKASI_STOK[index % LOKASI_STOK.length],
      aktifPublik: true,
    };
  });
}

export const SLUG_TOKO_TAMBAHAN = TOKO_BARU.map((t) => t.slug);

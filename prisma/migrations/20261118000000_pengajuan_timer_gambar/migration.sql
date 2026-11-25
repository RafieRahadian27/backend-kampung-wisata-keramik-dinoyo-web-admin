-- Migrasi keempat:
--   1. Timer pengajuan toko: `diajukan_pada` menjadi awal hitung mundur 3×24 jam. Pengajuan yang lewat
--      batas tanpa keputusan admin ditandai `kedaluwarsa` dan tidak bisa diverifikasi lagi.
--      Baris lama mendapat CURRENT_TIMESTAMP, jadi hitung mundurnya dimulai saat migrasi dijalankan.
--   2. Tabel `gambar`: catatan metadata setiap berkas Vercel Blob (url, ukuran, tipe, pemilik).
--      Berkas biner tetap di Blob; kolom toko.foto / toko.stempel / produk.foto tetap dipakai halaman.
-- AlterTable
ALTER TABLE `pengajuan` ADD COLUMN `diajukan_pada` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    ADD COLUMN `status` ENUM('menunggu', 'kedaluwarsa') NOT NULL DEFAULT 'menunggu';

-- CreateTable
CREATE TABLE `gambar` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `url` VARCHAR(255) NOT NULL,
    `pathname` VARCHAR(255) NOT NULL,
    `content_type` VARCHAR(40) NOT NULL,
    `ukuran` INTEGER UNSIGNED NOT NULL,
    `jenis` ENUM('toko_foto', 'toko_stempel', 'produk_foto') NOT NULL,
    `toko_id` INTEGER UNSIGNED NULL,
    `produk_id` INTEGER UNSIGNED NULL,
    `diunggah_oleh` INTEGER UNSIGNED NULL,
    `dibuat` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_gambar_url`(`url`),
    INDEX `fk_gambar_toko`(`toko_id`),
    INDEX `fk_gambar_produk`(`produk_id`),
    INDEX `fk_gambar_user`(`diunggah_oleh`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `idx_pengajuan_status` ON `pengajuan`(`status`, `diajukan_pada`);

-- AddForeignKey
ALTER TABLE `gambar` ADD CONSTRAINT `fk_gambar_toko` FOREIGN KEY (`toko_id`) REFERENCES `toko`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `gambar` ADD CONSTRAINT `fk_gambar_produk` FOREIGN KEY (`produk_id`) REFERENCES `produk`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `gambar` ADD CONSTRAINT `fk_gambar_user` FOREIGN KEY (`diunggah_oleh`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;


-- Backfill: berkas Blob yang sudah terpasang sebelum tabel ini ada ikut dicatat.
-- Ukuran asli tidak diketahui tanpa memanggil Blob API → 0; tipe ditebak dari ekstensi.
INSERT INTO `gambar` (`url`, `pathname`, `content_type`, `ukuran`, `jenis`, `toko_id`)
SELECT `foto`, SUBSTRING_INDEX(`foto`, '.vercel-storage.com/', -1),
       CASE WHEN `foto` LIKE '%.png' THEN 'image/png' WHEN `foto` LIKE '%.webp' THEN 'image/webp' ELSE 'image/jpeg' END,
       0, 'toko_foto', `id`
FROM `toko` WHERE `foto` LIKE 'https://%.public.blob.vercel-storage.com/%';

INSERT INTO `gambar` (`url`, `pathname`, `content_type`, `ukuran`, `jenis`, `toko_id`)
SELECT `stempel`, SUBSTRING_INDEX(`stempel`, '.vercel-storage.com/', -1),
       CASE WHEN `stempel` LIKE '%.png' THEN 'image/png' WHEN `stempel` LIKE '%.webp' THEN 'image/webp' ELSE 'image/jpeg' END,
       0, 'toko_stempel', `id`
FROM `toko` WHERE `stempel` LIKE 'https://%.public.blob.vercel-storage.com/%';

INSERT INTO `gambar` (`url`, `pathname`, `content_type`, `ukuran`, `jenis`, `produk_id`)
SELECT `foto`, SUBSTRING_INDEX(`foto`, '.vercel-storage.com/', -1),
       CASE WHEN `foto` LIKE '%.png' THEN 'image/png' WHEN `foto` LIKE '%.webp' THEN 'image/webp' ELSE 'image/jpeg' END,
       0, 'produk_foto', `id`
FROM `produk` WHERE `foto` LIKE 'https://%.public.blob.vercel-storage.com/%';

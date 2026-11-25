-- Migrasi awal: struktur tabel yang sebelumnya ditulis manual di database/schema.sql.

-- CreateTable
CREATE TABLE `akun` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(100) NOT NULL,
    `umur` TINYINT UNSIGNED NULL,
    `inisial` VARCHAR(4) NOT NULL,
    `nik` CHAR(16) NOT NULL,
    `email` VARCHAR(120) NOT NULL,
    `toko` VARCHAR(100) NOT NULL,
    `lokasi` VARCHAR(100) NOT NULL,
    `peran` ENUM('Pemilik Toko', 'Staf Pengrajin') NOT NULL,
    `whatsapp` VARCHAR(25) NOT NULL,
    `status` ENUM('aktif', 'menunggu', 'ditangguhkan') NOT NULL DEFAULT 'menunggu',
    `terakhir_aktif` VARCHAR(50) NOT NULL DEFAULT 'Belum pernah login',
    `tone` VARCHAR(12) NOT NULL DEFAULT 'neutral',

    UNIQUE INDEX `nik`(`nik`),
    UNIQUE INDEX `email`(`email`),
    INDEX `idx_akun_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(100) NOT NULL,
    `sapaan` VARCHAR(100) NOT NULL,
    `email` VARCHAR(120) NOT NULL,
    `username` VARCHAR(40) NOT NULL,
    `password_hash` VARCHAR(200) NOT NULL,
    `role` ENUM('admin', 'pengrajin') NOT NULL,
    `akun_id` INTEGER UNSIGNED NULL,

    UNIQUE INDEX `email`(`email`),
    UNIQUE INDEX `username`(`username`),
    INDEX `fk_users_akun`(`akun_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `toko` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(80) NOT NULL,
    `nama` VARCHAR(60) NOT NULL,
    `nib` VARCHAR(20) NOT NULL DEFAULT '-',
    `keterangan` VARCHAR(120) NOT NULL DEFAULT '',
    `pemilik` VARCHAR(100) NOT NULL,
    `whatsapp` VARCHAR(25) NOT NULL,
    `lokasi_gang` VARCHAR(60) NOT NULL DEFAULT '-',
    `wilayah` VARCHAR(120) NOT NULL,
    `alamat` VARCHAR(200) NOT NULL DEFAULT '',
    `koordinat` VARCHAR(40) NOT NULL DEFAULT '',
    `spesialisasi` VARCHAR(60) NOT NULL,
    `jumlah_produk` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `tahun_berdiri` SMALLINT UNSIGNED NOT NULL,
    `deskripsi` TEXT NOT NULL,
    `jam_buka` VARCHAR(80) NOT NULL,
    `status` ENUM('terverifikasi', 'menunggu', 'nonaktif') NOT NULL DEFAULT 'menunggu',
    `badge` ENUM('baru', 'unggulan', 'maestro') NULL,
    `foto` VARCHAR(200) NOT NULL,
    `aktif_publik` BOOLEAN NOT NULL DEFAULT false,
    `akreditasi` BOOLEAN NOT NULL DEFAULT false,
    `diperbarui` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `slug`(`slug`),
    INDEX `idx_toko_status`(`status`),
    INDEX `idx_toko_diperbarui`(`diperbarui`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `toko_kategori` (
    `toko_id` INTEGER UNSIGNED NOT NULL,
    `kategori` VARCHAR(60) NOT NULL,
    `urutan` TINYINT UNSIGNED NOT NULL DEFAULT 0,

    PRIMARY KEY (`toko_id`, `kategori`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_toko` (
    `user_id` INTEGER UNSIGNED NOT NULL,
    `toko_id` INTEGER UNSIGNED NOT NULL,

    INDEX `fk_ut_toko`(`toko_id`),
    PRIMARY KEY (`user_id`, `toko_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kategori_produk` (
    `nama` VARCHAR(60) NOT NULL,
    `urutan` TINYINT UNSIGNED NOT NULL DEFAULT 0,

    PRIMARY KEY (`nama`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `produk` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(120) NOT NULL,
    `sku` VARCHAR(30) NOT NULL,
    `toko_id` INTEGER UNSIGNED NOT NULL,
    `toko_label` VARCHAR(100) NOT NULL,
    `toko_inisial` VARCHAR(4) NOT NULL,
    `pengrajin` VARCHAR(100) NOT NULL,
    `teknik` VARCHAR(80) NOT NULL,
    `foto` VARCHAR(200) NOT NULL,
    `badge` VARCHAR(40) NULL,
    `kategori` VARCHAR(60) NOT NULL,
    `bahan` VARCHAR(80) NOT NULL,
    `harga` INTEGER UNSIGNED NOT NULL,
    `catatan_harga` VARCHAR(80) NOT NULL DEFAULT '',
    `status` ENUM('tersedia', 'habis', 'preorder') NOT NULL DEFAULT 'tersedia',
    `stok_label` VARCHAR(60) NOT NULL,
    `lokasi_stok` VARCHAR(80) NOT NULL,

    UNIQUE INDEX `sku`(`sku`),
    INDEX `fk_produk_toko`(`toko_id`),
    INDEX `fk_produk_kategori`(`kategori`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pengajuan` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(80) NOT NULL,
    `nama` VARCHAR(60) NOT NULL,
    `lokasi_gang` VARCHAR(60) NOT NULL,
    `pengrajin` VARCHAR(100) NOT NULL,
    `keahlian` VARCHAR(80) NOT NULL,
    `diajukan` VARCHAR(60) NOT NULL,
    `foto` VARCHAR(200) NOT NULL,

    UNIQUE INDEX `slug`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `token_hash` CHAR(64) NOT NULL,
    `user_id` INTEGER UNSIGNED NOT NULL,
    `created_at` DATETIME(0) NOT NULL,
    `expires_at` DATETIME(0) NOT NULL,

    INDEX `idx_sessions_user`(`user_id`),
    INDEX `idx_sessions_expires`(`expires_at`),
    PRIMARY KEY (`token_hash`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_log` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER UNSIGNED NULL,
    `aksi` VARCHAR(40) NOT NULL,
    `target` VARCHAR(120) NOT NULL,
    `detail` VARCHAR(255) NOT NULL DEFAULT '',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_audit_aksi`(`aksi`, `created_at`),
    INDEX `fk_audit_user`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `fk_users_akun` FOREIGN KEY (`akun_id`) REFERENCES `akun`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `toko_kategori` ADD CONSTRAINT `fk_kategori_toko` FOREIGN KEY (`toko_id`) REFERENCES `toko`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `user_toko` ADD CONSTRAINT `fk_ut_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `user_toko` ADD CONSTRAINT `fk_ut_toko` FOREIGN KEY (`toko_id`) REFERENCES `toko`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `produk` ADD CONSTRAINT `fk_produk_toko` FOREIGN KEY (`toko_id`) REFERENCES `toko`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `produk` ADD CONSTRAINT `fk_produk_kategori` FOREIGN KEY (`kategori`) REFERENCES `kategori_produk`(`nama`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `audit_log` ADD CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

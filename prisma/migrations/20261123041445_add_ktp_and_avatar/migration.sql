-- AlterTable
ALTER TABLE `akun` ADD COLUMN `foto_ktp` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `pengajuan` ADD COLUMN `foto_ktp` VARCHAR(255) NULL,
    ADD COLUMN `nik` CHAR(16) NULL,
    ADD COLUMN `whatsapp` VARCHAR(25) NULL;

-- AlterTable
ALTER TABLE `toko` ADD COLUMN `foto_ktp` VARCHAR(255) NULL,
    ADD COLUMN `nik` CHAR(16) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `avatar` VARCHAR(255) NULL;

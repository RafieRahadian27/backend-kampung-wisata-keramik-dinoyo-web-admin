-- Migrasi kedua: contoh evolusi skema setelah tabel awal dibuat.
-- Menambah kolom pelacakan login. Kolom NULL sehingga aman untuk baris yang sudah ada.

-- AlterTable
ALTER TABLE `users` ADD COLUMN `last_login_at` DATETIME(0) NULL;

-- AlterTable
ALTER TABLE `sessions` ADD COLUMN `ip_address` VARCHAR(45) NULL,
    ADD COLUMN `user_agent` VARCHAR(255) NULL;

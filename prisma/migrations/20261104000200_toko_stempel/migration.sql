-- Migrasi ketiga: stempel otentikasi kriya per toko, diunggah ke Vercel Blob.
-- Yang disimpan hanya URL berkasnya. Kolom NULL = toko belum punya stempel (aman untuk baris lama).

-- AlterTable
ALTER TABLE `toko` ADD COLUMN `stempel` VARCHAR(200) NULL;

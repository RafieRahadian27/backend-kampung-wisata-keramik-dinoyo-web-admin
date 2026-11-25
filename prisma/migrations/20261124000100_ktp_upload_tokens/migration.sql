CREATE TABLE `ktp_upload_tokens` (
  `token_hash` CHAR(64) NOT NULL,
  `pathname` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME(0) NOT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`token_hash`),
  INDEX `idx_ktp_upload_expires` (`expires_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

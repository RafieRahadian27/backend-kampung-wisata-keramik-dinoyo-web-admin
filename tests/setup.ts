/**
 * Diimpor PALING AWAL oleh setiap file tes, sebelum modul aplikasi dimuat.
 * Tes tidak membutuhkan MySQL maupun Vercel Blob: semua akses data di-mock per kasus,
 * Prisma Client hanya dibuat (belum terhubung) saat modul diimpor.
 */
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.DB_USER ??= "test";
process.env.DB_NAME ??= "dinoyo_test";

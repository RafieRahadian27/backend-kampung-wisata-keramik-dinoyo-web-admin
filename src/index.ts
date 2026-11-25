import { createApp } from "./app";
import { pingDatabase, prisma } from "./lib/prisma";
import { storage } from "./lib/storage";
import { env } from "./config/env";
import { logger } from "./logger";

/**
 * Jaring pengaman terakhir di level proses. Error dari handler async sudah ditangkap
 * errorHandler; dua handler ini hanya menangkap yang lolos (mis. Promise tanpa await
 * di luar siklus request) agar tercatat dan tidak mematikan server diam-diam.
 */
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "unhandledRejection");
});
process.on("uncaughtException", (error) => {
  // State aplikasi tidak lagi bisa dipercaya → catat lalu keluar (biarkan process manager me-restart).
  logger.fatal({ err: error }, "uncaughtException");
  logger.flush();
  process.exit(1);
});

async function start() {
  try {
    await pingDatabase();
    logger.info(`✓ Terhubung ke MySQL ${env.db.host}:${env.db.port}/${env.db.database} (pool maks. ${env.db.connectionLimit} koneksi)`);
  } catch (error) {
    logger.fatal({ err: error }, "✗ Tidak dapat terhubung ke MySQL");
    logger.info("  Jalankan MySQL (XAMPP Control Panel → MySQL → Start), lalu `npm run db:deploy` (atau `npm run db:reset` untuk data demo) bila tabel belum dibuat.");
    logger.flush();
    process.exit(1);
  }

  if (!storage.isConfigured()) {
    logger.warn("BLOB_READ_WRITE_TOKEN belum diisi — unggah foto toko akan dijawab 503 (lihat backend/.env.example).");
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info(`Dinoyo Admin API berjalan di http://localhost:${env.port}/api`);
  });

  // Graceful shutdown: berhenti menerima request, tunggu yang berjalan selesai, lalu tutup koneksi Prisma.
  const shutdown = (signal: string) => {
    logger.info(`${signal} diterima, mematikan server...`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

void start();

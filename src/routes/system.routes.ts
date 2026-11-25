import { Router } from "express";
import { pingDatabase } from "../lib/prisma";
import { env } from "../config/env";
import { noStore } from "../middleware/cacheControl";

const router = Router();

/** GET /api/health — publik. Ikut memeriksa koneksi database lewat pool. */
router.get("/", noStore, async (_req, res) => {
  const database = await pingDatabase()
    .then(() => "terhubung" as const)
    .catch(() => "terputus" as const);

  res.status(database === "terhubung" ? 200 : 503).json({
    success: database === "terhubung",
    data: {
      status: database === "terhubung" ? "ok" : "degraded",
      database,
      pool: { connectionLimit: env.db.connectionLimit },
      uptimeDetik: Math.round(process.uptime()),
      waktu: new Date().toISOString(),
    },
  });
});

export default router;

import { Router } from "express";
import { reportController } from "../controllers/report.controller";
import { authenticate } from "../middleware/authMiddleware";
import { requirePermission as can, requireRole } from "../middleware/requireRole";
import { cacheControl } from "../middleware/cacheControl";

/** Modul rute dashboard → di-mount di /api/dashboard. */
export const dashboardRouter = Router();
dashboardRouter.use(authenticate, requireRole("admin"), can("dashboard:read"));
dashboardRouter.get("/", cacheControl(30), reportController.dashboard);

/**
 * Modul rute laporan → di-mount di /api/laporan.
 * `{/:bagian}` adalah segmen opsional (sintaks Express 5):
 *   GET /api/laporan        → seluruh laporan
 *   GET /api/laporan/tren   → hanya bagian "tren"
 */
export const laporanRouter = Router();
laporanRouter.use(authenticate, requireRole("admin"), can("laporan:read"));
laporanRouter.get("{/:bagian}", cacheControl(60), reportController.laporan);

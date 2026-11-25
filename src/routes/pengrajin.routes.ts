import { Router } from "express";
import { pengrajinController } from "../controllers/pengrajin.controller";
import { authenticate } from "../middleware/authMiddleware";
import { cacheControl } from "../middleware/cacheControl";
import { requirePermission as can } from "../middleware/requireRole";
import { validate } from "../middleware/validate";
import { laporanTokoQuerySchema } from "../validators";

/** Dashboard Toko → di-mount di /api/beranda. */
export const berandaRouter = Router();
berandaRouter.use(authenticate, can("beranda:read"));
berandaRouter.get("/", cacheControl(30), pengrajinController.beranda);

/** Laporan kunjungan toko milik sendiri → di-mount di /api/laporan-toko?periode=7|30|90. */
export const laporanTokoRouter = Router();
laporanTokoRouter.use(authenticate, can("laporan-toko:read"));
laporanTokoRouter.get("/", cacheControl(60), validate({ query: laporanTokoQuerySchema }), pengrajinController.laporanToko);

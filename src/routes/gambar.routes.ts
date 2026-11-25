import { Router } from "express";
import { gambarController } from "../controllers/gambar.controller";
import { authenticate } from "../middleware/authMiddleware";
import { noStore } from "../middleware/cacheControl";
import { requireRole } from "../middleware/requireRole";

/** Modul rute catatan berkas Vercel Blob → di-mount di /api/gambar (khusus admin, hanya baca). */
const router = Router();

router.use(authenticate, requireRole("admin"));
router.get("/", noStore, gambarController.list);

export default router;

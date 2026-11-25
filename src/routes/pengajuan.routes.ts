import { Router } from "express";
import { pengajuanController } from "../controllers/pengajuan.controller";
import { authenticate } from "../middleware/authMiddleware";
import { requirePermission as can, requireRole } from "../middleware/requireRole";
import { validate } from "../middleware/validate";
import { correctionSchema, keputusanSchema } from "../validators";
import { slugParam } from "./params";
import { imageUpload } from "../middleware/upload";
import { env } from "../config/env";
import { uploadLimiter } from "../middleware/rateLimiter";

/** Modul rute pengajuan toko baru → di-mount di /api/pengajuan. */
const router = Router();

router.use(authenticate);
router.param("slug", slugParam);

router.get("/", requireRole("admin"), can("pengajuan:decide"), pengajuanController.list);
router.get("/:slug/foto-ktp", requireRole("admin"), can("pengajuan:decide"), pengajuanController.fotoKtp);
router.patch("/:slug", requireRole("admin"), can("pengajuan:decide"), validate({ body: keputusanSchema }), pengajuanController.putuskan);
router.post("/:slug/koreksi", requireRole("admin"), can("pengajuan:decide"), validate({ body: correctionSchema }), pengajuanController.requestCorrection);
router.post("/:slug/foto-ktp", requireRole("pengrajin"), uploadLimiter, ...imageUpload({ maxBytes: env.blob.maxFotoBytes }), pengajuanController.replaceKtp);

export default router;

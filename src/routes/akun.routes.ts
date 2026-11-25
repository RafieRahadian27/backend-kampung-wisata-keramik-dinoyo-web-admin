import { Router } from "express";
import { akunController } from "../controllers/akun.controller";
import { authenticate } from "../middleware/authMiddleware";
import { requirePermission as can, requireRole } from "../middleware/requireRole";
import { cacheControl } from "../middleware/cacheControl";
import { validate } from "../middleware/validate";
import { akunQuerySchema, akunStatusSchema } from "../validators";
import { idParam } from "./params";

/** Modul rute akun pengrajin → di-mount di /api/akun. */
const router = Router();

// Seluruh area ini khusus admin; izin per tindakan tetap dicek di tiap rute.
router.use(authenticate, requireRole("admin"));
router.param("id", idParam);

router.get("/", can("akun:read"), cacheControl(30), validate({ query: akunQuerySchema }), akunController.list);
router.patch("/:id/status", can("akun:update"), validate({ body: akunStatusSchema }), akunController.updateStatus);

export default router;

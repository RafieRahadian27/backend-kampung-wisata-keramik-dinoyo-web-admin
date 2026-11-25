import { Router } from "express";
import { env } from "../config/env";
import { tokoController } from "../controllers/toko.controller";
import { authenticate } from "../middleware/authMiddleware";
import { uploadLimiter } from "../middleware/rateLimiter";
import { requirePermission as can } from "../middleware/requireRole";
import { cacheControl } from "../middleware/cacheControl";
import { imageUpload } from "../middleware/upload";
import { validate } from "../middleware/validate";
import { tokoQuerySchema, tokoSchema } from "../validators";
import { slugParam } from "./params";
import { requireRole } from "../middleware/requireRole";

/** Modul rute toko → di-mount di /api/toko. */
const router = Router();

// Router-level middleware: berlaku untuk semua rute di modul ini saja.
router.use(authenticate);
// Validasi parameter :slug terpusat untuk semua rute di bawah.
router.param("slug", slugParam);

router.get("/:slug/foto-ktp", requireRole("admin"), can("toko:read"), tokoController.fotoKtp);

// Chainable route: satu path, beberapa HTTP method.
router
  .route("/")
  .get(can("toko:read"), cacheControl(30), validate({ query: tokoQuerySchema }), tokoController.list)
  .post(can("toko:create"), validate({ body: tokoSchema }), tokoController.create);

router
  .route("/:slug")
  .get(can("toko:read"), cacheControl(30), tokoController.detail)
  .put(can("toko:update"), validate({ body: tokoSchema }, { partial: true }), tokoController.update)
  .delete(can("toko:delete"), tokoController.remove);

// Rute bertingkat (nested resource): produk milik satu toko.
router.get("/:slug/produk", can("toko:read"), can("produk:read"), cacheControl(30), tokoController.produk);

/**
 * Unggah media toko → Vercel Blob: foto sampul (toko.foto) dan stempel otentikasi (toko.stempel).
 * Alur: izin → kuota unggah → validasi berkas (tipe, ukuran, magic bytes) → simpan ke storage
 * → catat URL di kolom toko + audit. Body = isi berkas mentah, Content-Type image/jpeg | png | webp.
 */
const uploadPipeline = [can("toko:update"), uploadLimiter, ...imageUpload({ maxBytes: env.blob.maxFotoBytes })];
router.put("/:slug/foto", ...uploadPipeline, tokoController.uploadMedia("foto"));
router.put("/:slug/stempel", ...uploadPipeline, tokoController.uploadMedia("stempel"));

export default router;

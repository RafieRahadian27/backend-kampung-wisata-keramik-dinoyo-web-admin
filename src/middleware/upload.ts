import express, { type NextFunction, type Request, type Response } from "express";
import { ALLOWED_IMAGE_TYPES, detectImageType, isAllowedImageType } from "../lib/fileType";
import { HttpError } from "../utils/httpError";

/**
 * Penerima unggahan gambar (route-level) — langkah "Validasi" sebelum berkas disimpan ke storage.
 *
 * Klien mengirim isi berkas apa adanya sebagai body request (bukan multipart), dengan header
 * Content-Type berisi tipe gambarnya. Lapisan pemeriksaan, dari yang paling murah:
 *   1. Content-Type harus image/jpeg | image/png | image/webp → selain itu 415
 *   2. Ukuran dibatasi `express.raw({ limit })`             → melebihi batas 413 (lihat errorHandler)
 *   3. Body tidak boleh kosong                              → 400
 *   4. Magic bytes harus cocok dengan Content-Type          → 422
 * Hasil yang lolos disimpan di `req.file` untuk controller.
 */
export function imageUpload({ maxBytes }: { maxBytes: number }) {
  const raw = express.raw({ type: [...ALLOWED_IMAGE_TYPES], limit: maxBytes });

  const checkType = (req: Request, _res: Response, next: NextFunction) => {
    const contentType = req.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (!isAllowedImageType(contentType)) {
      throw new HttpError(415, "Berkas harus berupa gambar JPEG, PNG, atau WebP", { code: "UNSUPPORTED_FILE_TYPE" });
    }
    next();
  };

  const inspect = (req: Request, _res: Response, next: NextFunction) => {
    const body = req.body as unknown;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new HttpError(400, "Berkas gambar belum dikirim", { code: "FILE_REQUIRED" });
    }
    const declared = req.get("content-type")!.split(";")[0].trim().toLowerCase();
    const actual = detectImageType(body);
    if (!actual || actual !== declared) {
      throw new HttpError(422, "Isi berkas bukan gambar JPEG, PNG, atau WebP yang valid", { code: "INVALID_FILE_CONTENT" });
    }
    req.file = { buffer: body, contentType: actual, size: body.length };
    next();
  };

  return [checkType, raw, inspect];
}

import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpError";

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH"]);

/**
 * Rute unggah berkas yang membaca body biner dengan parser sendiri (lihat middleware/upload.ts).
 * Hanya rute di daftar ini yang dikecualikan; tipe & isi berkasnya diperiksa di rute tersebut.
 */
const UPLOAD_ROUTES = [
  /^\/api\/auth\/register\/ktp\/?$/,
  /^\/api\/toko\/[^/]+\/(?:foto|stempel)\/?$/,
  /^\/api\/produk\/\d+\/foto\/?$/,
];

/**
 * Tolak body non-JSON pada POST/PUT/PATCH dengan 415, alih-alih diam-diam
 * menghasilkan `req.body` kosong. Request tanpa body (mis. POST /auth/logout) tetap lolos.
 * Efek samping yang baik: form HTML lintas situs tidak bisa mengirim JSON tanpa preflight CORS.
 */
export function requireJson(req: Request, _res: Response, next: NextFunction) {
  const hasBody = Number(req.get("content-length") ?? 0) > 0 || req.get("transfer-encoding") !== undefined;
  const isUpload = UPLOAD_ROUTES.some((route) => route.test(req.path));
  if (METHODS_WITH_BODY.has(req.method) && hasBody && !isUpload && !req.is("application/json")) {
    throw new HttpError(415, "Body request harus berformat application/json");
  }
  next();
}

import type { NextFunction, Request, Response } from "express";
import type { SuccessOptions } from "../types/express";
import { stripSensitive } from "../utils/sanitize";

/**
 * Augmentasi response — standarisasi format & transformasi field.
 *
 * 1. `res.success(data, { message, meta, status })` membungkus hasil dalam kerangka seragam:
 *      { success: true, message?, data, meta? }
 *    Error dibungkus dengan kerangka yang sama oleh `errorHandler`:
 *      { success: false, message, error: { code, details? }, meta: { requestId, timestamp } }
 *
 * 2. `res.json` dibungkus agar SEMUA output melewati `stripSensitive` (buang kolom kata sandi/token).
 *
 * Catatan: requestId & timestamp sengaja tidak dimasukkan ke body sukses. Isinya berubah tiap
 * request sehingga ETag ikut berubah dan cache 304 tidak pernah terjadi. requestId tetap tersedia
 * di header X-Request-Id.
 */
export function responseFormatter(_req: Request, res: Response, next: NextFunction) {
  const json = res.json.bind(res);
  res.json = ((body: unknown) => json(stripSensitive(body))) as Response["json"];

  res.success = function success<T>(data: T, { status = 200, message, meta }: SuccessOptions = {}) {
    return this.status(status).json({
      success: true,
      ...(message ? { message } : {}),
      data,
      ...(meta ? { meta } : {}),
    });
  };
  next();
}

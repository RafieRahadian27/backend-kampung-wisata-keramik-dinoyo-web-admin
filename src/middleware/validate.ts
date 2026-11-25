import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpError";
import { type FieldError, parseSchema, type Schema } from "../utils/schema";

interface ValidateTargets {
  body?: Schema;
  query?: Schema;
  params?: Schema;
}

/**
 * Augmentasi request — validasi input dengan skema (middleware factory).
 *
 * Dipasang per rute sebagai salah satu callback berurutan, contoh:
 *   router.post("/", can("toko:create"), validate({ body: tokoSchema }), tokoController.create)
 *
 * Hasil yang lolos validasi (sudah di-trim, di-coerce, field asing dibuang) disimpan di
 * `req.validated.{body,query,params}` sehingga controller tidak lagi menyentuh input mentah.
 * Bila gagal → 422 dengan daftar field yang bermasalah di `error.details`.
 */
export function validate(targets: ValidateTargets, { partial = false } = {}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: FieldError[] = [];
    for (const key of ["params", "query", "body"] as const) {
      const schema = targets[key];
      if (!schema) continue;
      // Mode parsial hanya berlaku untuk body; params & query dinilai apa adanya.
      const result = parseSchema(schema, req[key], partial && key === "body");
      errors.push(...result.errors);
      req.validated[key] = result.value;
    }

    if (errors.length > 0) {
      const message = errors.length === 1 ? errors[0].message : `${errors.length} field tidak valid: ${errors.map((e) => e.field).join(", ")}`;
      throw new HttpError(422, message, { details: errors });
    }
    next();
  };
}

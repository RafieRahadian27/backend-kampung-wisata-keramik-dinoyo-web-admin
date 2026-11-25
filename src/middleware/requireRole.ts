import type { NextFunction, Request, Response } from "express";
import { hasPermission } from "../auth/policy";
import type { Permission, Role } from "../types";
import { HttpError } from "../utils/httpError";
import { currentUser } from "./authMiddleware";

/**
 * Otorisasi — "Apa yang boleh kamu lakukan?". Dipasang SETELAH `authenticate`, karena membaca
 * `req.user` yang sudah diverifikasi. Login tapi tidak berhak → 403 (bukan 401).
 *
 * Dua tingkat pemeriksaan:
 *  - requireRole("admin")            → gerbang kasar per area, mis. seluruh /api/akun khusus admin
 *  - requirePermission("toko:create") → izin per tindakan, diturunkan dari peran di auth/policy.ts
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!roles.includes(currentUser(req).role)) {
      throw new HttpError(403, "Peran akun Anda tidak diizinkan mengakses fitur ini");
    }
    next();
  };
}

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!hasPermission(currentUser(req), permission)) {
      throw new HttpError(403, "Anda tidak memiliki izin untuk tindakan ini");
    }
    next();
  };
}

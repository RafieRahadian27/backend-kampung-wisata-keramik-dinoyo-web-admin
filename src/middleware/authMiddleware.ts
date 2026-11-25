import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { authService } from "../services/auth.service";
import type { AuthenticatedUser } from "../types";
import { HttpError } from "../utils/httpError";

/**
 * Token dibaca dari header `Authorization: Bearer <token>` (dipakai server Next.js),
 * atau dari cookie HttpOnly yang di-set saat login (untuk klien browser/Postman).
 * Header sudah diseragamkan oleh `normalizeHeaders`, jadi cukup cek prefiks "Bearer ".
 */
function readToken(req: Request): string | undefined {
  const header = req.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length) || undefined;
  const cookie = (req.cookies as Record<string, string> | undefined)?.[env.sessionCookie];
  return cookie || undefined;
}

/**
 * Router-level middleware: autentikasi "Siapa kamu?" — token tidak ada/tidak valid → 401.
 * Token dicocokkan ke tabel `sessions` lewat Prisma; bila sah, identitas pengguna yang SUDAH
 * DIVERIFIKASI server disisipkan ke `req.user` (dan `req.auth` beserta tokennya) untuk
 * dipakai middleware & handler berikutnya. Data dari klien tidak pernah dipercaya untuk ini.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = readToken(req);
  const user = token ? await authService.resolveSession(token) : null;
  if (!token || !user) {
    res.set("WWW-Authenticate", 'Bearer realm="dinoyo-admin"');
    throw new HttpError(401, "Sesi tidak valid atau sudah berakhir. Silakan login kembali.");
  }
  req.user = user;
  req.auth = { user, token };
  next();
}

export function currentUser(req: Request): AuthenticatedUser {
  if (!req.user) throw new HttpError(401, "Sesi tidak valid atau sudah berakhir. Silakan login kembali.");
  return req.user;
}

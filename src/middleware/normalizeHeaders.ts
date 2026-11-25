import type { NextFunction, Request, Response } from "express";

/**
 * Augmentasi request — standarisasi header sebelum dibaca middleware lain.
 *
 * - Nilai header string di-trim (Node sudah menyeragamkan nama header jadi huruf kecil).
 * - Skema Authorization diseragamkan: "bearer   abc" / "BEARER abc" → "Bearer abc",
 *   sehingga middleware autentikasi cukup memeriksa satu bentuk.
 * - Accept kosong atau "*\/*" dianggap "application/json" (API ini hanya berbicara JSON).
 */
export function normalizeHeaders(req: Request, _res: Response, next: NextFunction) {
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === "string") req.headers[name] = value.trim();
  }

  const authorization = req.headers.authorization;
  if (authorization) {
    const match = /^bearer\s+(.+)$/i.exec(authorization);
    req.headers.authorization = match ? `Bearer ${match[1].trim()}` : authorization;
  }

  if (!req.headers.accept || req.headers.accept === "*/*") {
    req.headers.accept = "application/json";
  }
  next();
}

import type { NextFunction, Request, Response } from "express";

/**
 * Menambahkan header Cache-Control pada response GET sehingga klien
 * dapat menyimpan data sementara dan tidak melakukan request berulang.
 * Express juga otomatis mengirim ETag sehingga request ulang cukup dijawab 304.
 *
 * Data bergantung pada siapa yang login, jadi cache wajib `private`
 * (tidak boleh disimpan CDN/proxy bersama) dan dibedakan per header Authorization.
 */
export function cacheControl(maxAgeSeconds: number) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.set("Cache-Control", `private, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 2}`);
    res.vary("Authorization");
    next();
  };
}

/** Untuk data sensitif (token, profil sesi): jangan pernah disimpan di cache mana pun. */
export function noStore(_req: Request, res: Response, next: NextFunction) {
  res.set("Cache-Control", "no-store");
  next();
}

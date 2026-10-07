import type { NextFunction, Request, Response } from "express";

/**
 * Menambahkan header Cache-Control pada response GET sehingga klien/CDN
 * dapat menyimpan data sementara dan tidak melakukan request berulang.
 * Express juga otomatis mengirim ETag sehingga request ulang cukup dijawab 304.
 */
export function cacheControl(maxAgeSeconds: number) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.set("Cache-Control", `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 2}`);
    next();
  };
}

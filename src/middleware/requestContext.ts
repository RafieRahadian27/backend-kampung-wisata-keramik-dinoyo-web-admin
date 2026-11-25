import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const VALID_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Application-level middleware (dipasang dengan `app.use`, berjalan di setiap request).
 *
 * Augmentasi request: menyisipkan `req.context` berisi ID unik & waktu mulai.
 * ID dari klien (header X-Request-Id) dipakai ulang bila formatnya aman, sehingga
 * satu permintaan bisa ditelusuri dari frontend sampai log backend.
 */
export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = req.get("x-request-id");
  const requestId = incoming && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();

  req.context = { requestId, startedAt: Date.now() };
  req.validated = {};
  res.set("X-Request-Id", requestId);
  next();
}

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Request } from "express";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";
import { logger } from "../logger";

/** Path tanpa query string — query bisa memuat kata kunci pencarian atau data lain yang tidak perlu dicatat. */
const pathOf = (url: string | undefined) => (url ?? "").split("?")[0];

/**
 * Application-level middleware: log terstruktur satu baris per request, ditulis setelah
 * response selesai. Isi tiap baris: requestId, method, path, status, durasi (responseTime ms),
 * dan id pengguna bila sudah login.
 *
 * Yang SENGAJA tidak dicatat: header (Authorization/Cookie), body request, dan query string.
 * Serializer di bawah hanya meneruskan field yang aman; `redact` di src/logger.ts menjadi lapisan kedua.
 *
 * requestId dibuat oleh `requestContext` (dipasang tepat sebelum middleware ini), sehingga ID
 * yang sama muncul di header X-Request-Id, di body respons error, dan di setiap baris log.
 */
export function createRequestLogger(baseLogger: Logger) {
  return pinoHttp({
    logger: baseLogger,
    genReqId: (req) => (req as Request).context.requestId,
    wrapSerializers: false,
    serializers: {
      req: (req: IncomingMessage & { id?: string }) => ({ id: req.id, method: req.method, path: pathOf((req as Request).originalUrl ?? req.url) }),
      res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
    },
    // `requestId` di level atas tiap baris → mudah dicari: semua log satu kejadian punya ID yang sama.
    customProps: (req) => {
      const { context, auth } = req as Request;
      return { requestId: context.requestId, ...(auth ? { userId: auth.user.id, role: auth.user.role } : {}) };
    },
    // 5xx = error (perlu ditindaklanjuti), 4xx = warn (kesalahan klien), sisanya info.
    customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
    customSuccessMessage: (req, res, responseTime) => `${req.method} ${pathOf((req as Request).originalUrl)} -> ${res.statusCode} (${Math.round(responseTime)}ms)`,
    customErrorMessage: (req, res) => `${req.method} ${pathOf((req as Request).originalUrl)} -> ${res.statusCode} gagal`,
  });
}

export const requestLogger = createRequestLogger(logger);

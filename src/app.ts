import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/logger";
import apiRouter from "./routes";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        // Saat development, izinkan localhost/127.0.0.1 di port mana pun (mis. Next.js pindah ke 3001).
        const isLocalDev = !env.isProduction && !!origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
        callback(null, !origin || isLocalDev || env.clientOrigins.includes(origin));
      },
    }),
  );
  app.use(express.json());
  app.use(requestLogger);

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

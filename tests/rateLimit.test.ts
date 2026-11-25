import "./helpers";
import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import express from "express";
import request from "supertest";
import { createApp } from "../src/app";
import { errorHandler } from "../src/middleware/errorHandler";
import { rateLimit } from "../src/middleware/rateLimiter";
import { requestContext } from "../src/middleware/requestContext";
import { requestLogger } from "../src/middleware/logger";
import { authService } from "../src/services/auth.service";
import { HttpError } from "../src/utils/httpError";

afterEach(() => mock.restoreAll());

describe("Rate limiter", () => {
  it("menjawab 429 + Retry-After setelah kuota habis", async () => {
    const app = express();
    app.use(requestContext, requestLogger);
    app.get("/ping", rateLimit({ windowMs: 60_000, max: 3, key: () => "satu-klien", message: (menit) => `Tunggu ${menit} menit` }), (_req, res) => {
      res.json({ ok: true });
    });
    app.use(errorHandler);

    for (let i = 0; i < 3; i++) assert.equal((await request(app).get("/ping")).status, 200);
    const res = await request(app).get("/ping");
    assert.equal(res.status, 429);
    assert.equal(res.body.error.code, "TOO_MANY_REQUESTS");
    assert.equal(res.headers["ratelimit-remaining"], "0");
    assert.ok(Number(res.headers["retry-after"]) > 0);
  });

  it("login: 5 percobaan gagal → percobaan ke-6 ditolak 429 tanpa memeriksa kata sandi", async () => {
    const app = createApp();
    const login = mock.method(authService, "login", async () => {
      throw new HttpError(401, "Email/username atau kata sandi salah");
    });

    const body = { identifier: "penyerang@uji.test", password: "tebakan" };
    for (let i = 0; i < 5; i++) assert.equal((await request(app).post("/api/auth/login").send(body)).status, 401);
    const res = await request(app).post("/api/auth/login").send(body);
    assert.equal(res.status, 429);
    assert.match(res.body.message, /Terlalu banyak percobaan login/);
    assert.equal(login.mock.callCount(), 5);
  });
});

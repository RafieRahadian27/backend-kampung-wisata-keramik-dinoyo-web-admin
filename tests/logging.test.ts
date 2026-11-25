import "./helpers";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { describe, it } from "node:test";
import express from "express";
import request from "supertest";
import { createLogger } from "../src/logger";
import { errorHandler } from "../src/middleware/errorHandler";
import { createRequestLogger } from "../src/middleware/logger";
import { requestContext } from "../src/middleware/requestContext";
import { HttpError } from "../src/utils/httpError";

/** Logger yang menulis ke array, agar isi log bisa diperiksa. */
function captureLogs() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(...String(chunk).split("\n").filter(Boolean));
      callback();
    },
  });
  return { lines, logger: createLogger(stream, { level: "info" }) };
}

function appWith(logger: ReturnType<typeof captureLogs>["logger"]) {
  const app = express();
  app.use(requestContext, createRequestLogger(logger), express.json());
  app.post("/api/auth/login", () => {
    throw new HttpError(401, "Kata sandi salah");
  });
  app.get("/api/rusak", () => {
    throw new Error("detail internal: koneksi ke 10.0.0.5 ditolak");
  });
  app.use(errorHandler);
  return app;
}

const waitForFlush = () => new Promise((resolve) => setImmediate(resolve));

describe("Request logger terstruktur", () => {
  it("mencatat requestId, method, path, status, durasi — tanpa query string", async () => {
    const { lines, logger } = captureLogs();
    const res = await request(appWith(logger)).post("/api/auth/login?ref=email-promo").send({ identifier: "a@b.co", password: "x" });
    await waitForFlush();

    const entry = JSON.parse(lines.at(-1)!);
    assert.equal(entry.requestId, res.headers["x-request-id"], "ID di log = ID di header respons");
    assert.equal(entry.req.method, "POST");
    assert.equal(entry.req.path, "/api/auth/login");
    assert.equal(entry.res.statusCode, 401);
    assert.equal(typeof entry.responseTime, "number");
    assert.equal(entry.level, 40, "4xx dicatat sebagai warn");
  });

  it("tidak pernah mencatat password, token, cookie, atau header authorization", async () => {
    const { lines, logger } = captureLogs();
    await request(appWith(logger))
      .post("/api/auth/login")
      .set("Authorization", "Bearer token-sangat-rahasia")
      .set("Cookie", "kd_api_session=cookie-sangat-rahasia")
      .send({ identifier: "a@b.co", password: "KataSandiRahasia123" });
    await waitForFlush();

    const raw = lines.join("\n");
    for (const secret of ["token-sangat-rahasia", "cookie-sangat-rahasia", "KataSandiRahasia123"]) {
      assert.ok(!raw.includes(secret), `"${secret}" bocor ke log`);
    }
  });

  it("error 500: detail & stack masuk log (level error), bukan ke respons", async () => {
    const { lines, logger } = captureLogs();
    const res = await request(appWith(logger)).get("/api/rusak");
    await waitForFlush();

    assert.equal(res.status, 500);
    assert.ok(!JSON.stringify(res.body).includes("10.0.0.5"));
    const entry = JSON.parse(lines.at(-1)!);
    assert.equal(entry.level, 50);
    assert.equal(entry.requestId, res.body.meta.requestId);
    assert.match(entry.err.message, /10\.0\.0\.5/);
    assert.match(entry.err.stack, /logging\.test\.ts/);
  });

  it("redact menyensor field sensitif walau tidak sengaja di-log manual", async () => {
    const { lines, logger } = captureLogs();
    logger.info({ body: { password: "bocor-1", token: "bocor-2" }, req: { headers: { authorization: "Bearer bocor-3" } } }, "uji");
    await waitForFlush();
    assert.ok(!/bocor-\d/.test(lines.join("\n")));
    assert.match(lines[0], /\[DISENSOR\]/);
  });
});

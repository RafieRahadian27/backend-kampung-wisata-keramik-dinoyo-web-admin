import { BEARER, fakeUser, type JsonBody, loginAs } from "./helpers";
import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import request from "supertest";
import { createApp } from "../src/app";
import { tokoService } from "../src/services/toko.service";
import { HttpError } from "../src/utils/httpError";

const app = createApp();

afterEach(() => mock.restoreAll());

/** Kerangka error standar: { success:false, message, error:{ code }, meta:{ requestId } } */
function assertErrorShape(res: { body: JsonBody; headers: Record<string, string> }) {
  assert.equal(res.body.success, false);
  assert.equal(typeof res.body.message, "string");
  assert.equal(typeof res.body.error?.code, "string");
  assert.equal(res.body.meta?.requestId, res.headers["x-request-id"], "requestId di body harus sama dengan header X-Request-Id");
}

describe("Input tidak valid → 4xx (bukan 500)", () => {
  it("422 saat body login tidak lengkap, beserta daftar field", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    assert.equal(res.status, 422);
    assertErrorShape(res);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.deepEqual(
      res.body.error.details.map((detail: { field: string }) => detail.field),
      ["identifier", "password"],
    );
  });

  it("400 saat JSON rusak", async () => {
    const res = await request(app).post("/api/auth/login").set("Content-Type", "application/json").send('{"identifier":');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_JSON");
  });

  it("415 saat body bukan JSON", async () => {
    const res = await request(app).post("/api/auth/login").set("Content-Type", "text/plain").send("identifier=a");
    assert.equal(res.status, 415);
  });

  it("413 saat body JSON melebihi 100 KB", async () => {
    const res = await request(app).post("/api/auth/login").send({ identifier: "a".repeat(120_000), password: "x" });
    assert.equal(res.status, 413);
    assert.equal(res.body.error.code, "PAYLOAD_TOO_LARGE");
  });

  it("400 saat parameter :id bukan angka", async () => {
    loginAs(fakeUser("admin"));
    const res = await request(app).delete("/api/produk/abc").set(BEARER);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "INVALID_ID");
  });
});

describe("Autentikasi & otorisasi → 401 / 403", () => {
  it("401 tanpa token + header WWW-Authenticate", async () => {
    const res = await request(app).get("/api/toko");
    assert.equal(res.status, 401);
    assertErrorShape(res);
    assert.equal(res.body.error.code, "UNAUTHENTICATED");
    assert.match(res.headers["www-authenticate"], /^Bearer/);
  });

  it("401 saat token tidak dikenal / sudah dicabut", async () => {
    loginAs(null);
    const res = await request(app).get("/api/toko").set(BEARER);
    assert.equal(res.status, 401);
  });

  it("403 saat pengrajin membuka modul akun (khusus admin)", async () => {
    loginAs(fakeUser("pengrajin"));
    const res = await request(app).get("/api/akun").set(BEARER);
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "FORBIDDEN");
  });

  it("403 saat pengrajin mencoba membuat toko (izin per tindakan)", async () => {
    loginAs(fakeUser("pengrajin"));
    const res = await request(app).post("/api/toko").set(BEARER).send({ nama: "Toko Baru" });
    assert.equal(res.status, 403);
  });
});

describe("Data / rute tidak ditemukan → 404", () => {
  it("admin KTP endpoint rejects anonymous request and returns 404 for missing KTP", async () => {
    const anonymous = await request(app).get("/api/toko/toko-uji/foto-ktp");
    assert.equal(anonymous.status, 401);
    loginAs(fakeUser("admin"));
    mock.method(tokoService, "findFotoKtp", async () => null);
    const missing = await request(app).get("/api/toko/toko-uji/foto-ktp").set(BEARER);
    assert.equal(missing.status, 404);
  });

  it("404 untuk endpoint yang tidak ada", async () => {
    const res = await request(app).get("/api/tidak-ada/sama-sekali");
    assert.equal(res.status, 404);
    assertErrorShape(res);
    assert.equal(res.body.error.code, "ROUTE_NOT_FOUND");
  });

  it("404 untuk path di luar /api", async () => {
    const res = await request(app).get("/bukan-api");
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, "ROUTE_NOT_FOUND");
  });

  it("404 untuk toko yang tidak ada / bukan milik pengguna", async () => {
    loginAs(fakeUser("admin"));
    mock.method(tokoService, "findBySlug", async (_user: unknown, slug: string) => {
      throw new HttpError(404, `Toko dengan slug "${slug}" tidak ditemukan`);
    });
    const res = await request(app).get("/api/toko/toko-hantu").set(BEARER);
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, "NOT_FOUND");
  });
});

describe("Error tak terduga → 500 tanpa detail internal", () => {
  it("pesan umum, tanpa stack trace / pesan asli / debug", async () => {
    loginAs(fakeUser("admin"));
    mock.method(tokoService, "findAll", async () => {
      throw new Error("ER_PARSE_ERROR near 'password_hash' at /srv/app/src/repositories/toko.repository.ts:42");
    });
    mock.method(tokoService, "ringkasan", async () => ({ total: 0, terverifikasi: 0, menunggu: 0, nonaktif: 0, katalogAktif: 0 }));

    const res = await request(app).get("/api/toko").set(BEARER);
    assert.equal(res.status, 500);
    assertErrorShape(res);
    assert.equal(res.body.message, "Terjadi kesalahan pada server");
    assert.equal(res.body.error.code, "INTERNAL_ERROR");
    assert.deepEqual(Object.keys(res.body.error), ["code"]);
    const raw = JSON.stringify(res.body);
    assert.ok(!raw.includes("password_hash"), "pesan asli tidak boleh bocor");
    assert.ok(!raw.includes(".ts:"), "stack trace tidak boleh bocor");
  });
});

describe("Request ID", () => {
  it("dibuat server bila klien tidak mengirim", async () => {
    const res = await request(app).get("/api/tidak-ada");
    assert.match(res.headers["x-request-id"], /^[0-9a-f-]{36}$/);
  });

  it("ID klien yang formatnya aman dipakai ulang", async () => {
    const res = await request(app).get("/api/tidak-ada").set("X-Request-Id", "frontend-abc12345");
    assert.equal(res.headers["x-request-id"], "frontend-abc12345");
    assert.equal(res.body.meta.requestId, "frontend-abc12345");
  });

  it("ID klien berbahaya diganti (mencegah log injection)", async () => {
    const res = await request(app).get("/api/tidak-ada").set("X-Request-Id", 'x" injected=1 <script>');
    assert.match(res.headers["x-request-id"], /^[0-9a-f-]{36}$/);
  });
});

describe("Header keamanan (Helmet)", () => {
  it("nosniff, DENY, CSP ketat, tanpa X-Powered-By", async () => {
    const res = await request(app).get("/api/tidak-ada");
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.equal(res.headers["x-frame-options"], "DENY");
    assert.match(res.headers["content-security-policy"], /default-src 'none'/);
    assert.equal(res.headers["x-powered-by"], undefined);
  });
});

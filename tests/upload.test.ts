import { BEARER, fakeUser, loginAs, PNG_1PX } from "./helpers";
import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import request from "supertest";
import { createApp } from "../src/app";
import { env } from "../src/config/env";
import { detectImageType } from "../src/lib/fileType";
import { prisma } from "../src/lib/prisma";
import { storage } from "../src/lib/storage";
import { auditRepository } from "../src/repositories/audit.repository";
import { gambarRepository } from "../src/repositories/gambar.repository";
import { tokoRepository } from "../src/repositories/toko.repository";
import { tokoService } from "../src/services/toko.service";
import type { Toko } from "../src/types";

const app = createApp();
const URL_LAMA = "https://abc123.public.blob.vercel-storage.com/toko/toko-uji/sampul-lama.jpg";
const URL_BARU = "https://abc123.public.blob.vercel-storage.com/toko/toko-uji/sampul-Xy12.png";

// Prisma Client adalah Proxy: $transaction tidak bisa di-mock lewat mock.method, jadi ditimpa manual.
const originalTransaction = prisma.$transaction;
afterEach(() => {
  mock.restoreAll();
  prisma.$transaction = originalTransaction;
});

const fotoRequest = (slug = "toko-uji") => request(app).put(`/api/toko/${slug}/foto`).set(BEARER);

describe("Validasi berkas di PUT /api/toko/:slug/foto", () => {
  it("401 tanpa sesi — berkas tidak diproses sama sekali", async () => {
    const res = await request(app).put("/api/toko/toko-uji/foto").set("Content-Type", "image/png").send(PNG_1PX);
    assert.equal(res.status, 401);
  });

  it("415 untuk tipe selain JPEG/PNG/WebP (mis. SVG yang bisa memuat skrip)", async () => {
    loginAs(fakeUser("admin"));
    const res = await fotoRequest().set("Content-Type", "image/svg+xml").send(Buffer.from("<svg onload=alert(1)>"));
    assert.equal(res.status, 415);
    assert.equal(res.body.error.code, "UNSUPPORTED_FILE_TYPE");
  });

  it("422 saat isi berkas tidak cocok dengan Content-Type (HTML menyamar jadi PNG)", async () => {
    loginAs(fakeUser("admin"));
    const res = await fotoRequest().set("Content-Type", "image/png").send(Buffer.from("<html><script>alert(1)</script></html>"));
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, "INVALID_FILE_CONTENT");
  });

  it("400 saat body kosong", async () => {
    loginAs(fakeUser("admin"));
    const res = await fotoRequest().set("Content-Type", "image/png").send(Buffer.alloc(0));
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "FILE_REQUIRED");
  });

  it("413 saat melebihi batas ukuran", async () => {
    loginAs(fakeUser("admin"));
    const besar = Buffer.concat([PNG_1PX, Buffer.alloc(env.blob.maxFotoBytes)]);
    const res = await fotoRequest().set("Content-Type", "image/png").send(besar);
    assert.equal(res.status, 413);
    assert.equal(res.body.error.code, "PAYLOAD_TOO_LARGE");
  });

  it("200 untuk PNG sah — controller menerima buffer yang sudah tervalidasi", async () => {
    loginAs(fakeUser("pengrajin"));
    const updateFoto = mock.method(tokoService, "updateMedia", async () => ({ slug: "toko-uji", foto: URL_BARU }) as Toko);

    const res = await fotoRequest().set("Content-Type", "image/png").send(PNG_1PX);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.foto, URL_BARU);
    const [, slug, jenis, file] = updateFoto.mock.calls[0].arguments;
    assert.equal(jenis, "foto");
    assert.equal(slug, "toko-uji");
    assert.equal(file?.contentType, "image/png");
    assert.equal(file?.size, PNG_1PX.length);
  });

  it("PUT /:slug/stempel memakai validasi yang sama dan menyimpan ke kolom stempel", async () => {
    loginAs(fakeUser("admin"));
    const ditolak = await request(app).put("/api/toko/toko-uji/stempel").set(BEARER).set("Content-Type", "image/svg+xml").send(Buffer.from("<svg/>"));
    assert.equal(ditolak.status, 415);

    const updateMedia = mock.method(tokoService, "updateMedia", async () => ({ slug: "toko-uji", stempel: URL_BARU }) as Toko);
    const res = await request(app).put("/api/toko/toko-uji/stempel").set(BEARER).set("Content-Type", "image/png").send(PNG_1PX);
    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Stempel toko berhasil diunggah");
    assert.equal(updateMedia.mock.calls[0].arguments[2], "stempel");
  });
});

describe("detectImageType (magic bytes)", () => {
  it("mengenali JPEG, PNG, WebP dan menolak lainnya", () => {
    assert.equal(detectImageType(Buffer.from("ffd8ffe000104a4649460001", "hex")), "image/jpeg");
    assert.equal(detectImageType(PNG_1PX), "image/png");
    assert.equal(detectImageType(Buffer.from("RIFF\x24\x00\x00\x00WEBPVP8 ", "latin1")), "image/webp");
    assert.equal(detectImageType(Buffer.from("GIF89a......")), undefined);
    assert.equal(detectImageType(Buffer.from("%PDF-1.7....")), undefined);
  });
});

describe("tokoService.updateMedia: simpan ke storage → catat referensi", () => {
  const file = { buffer: PNG_1PX, contentType: "image/png" as const, size: PNG_1PX.length };

  function arrange({ gagalSimpan = false } = {}) {
    mock.method(tokoService, "findBySlug", async () => ({ slug: "toko-uji", foto: URL_LAMA }) as Toko);
    prisma.$transaction = (async (work: (tx: unknown) => unknown) => work({})) as typeof prisma.$transaction;
    mock.method(tokoRepository, "lockBySlug", async () => ({ id: 7, nama: "Toko Uji", foto: URL_LAMA, stempel: null }));
    const update = mock.method(tokoRepository, "update", async () => {
      if (gagalSimpan) throw new Error("koneksi database putus");
    });
    const audit = mock.method(auditRepository, "insert", async () => undefined);
    const catatGambar = mock.method(gambarRepository, "insert", async () => 1);
    const lepasGambar = mock.method(gambarRepository, "removeByUrl", async () => undefined);
    const upload = mock.method(storage, "upload", async () => ({ url: URL_BARU, pathname: "toko/toko-uji/sampul-Xy12.png" }));
    const remove = mock.method(storage, "remove", async () => undefined);
    return { update, audit, upload, remove, catatGambar, lepasGambar };
  }

  it("URL Blob dicatat di toko.foto + audit, lalu berkas lama dihapus", async () => {
    const { update, audit, upload, remove, catatGambar, lepasGambar } = arrange();
    await tokoService.updateMedia(fakeUser("admin"), "toko-uji", "foto", file);

    // Tabel gambar: catatan foto lama dilepas, unggahan baru dicatat beserta metadata & pemiliknya.
    assert.equal(lepasGambar.mock.calls[0].arguments[1], URL_LAMA);
    assert.deepEqual(catatGambar.mock.calls[0].arguments[1], {
      url: URL_BARU,
      pathname: "toko/toko-uji/sampul-Xy12.png",
      contentType: "image/png",
      ukuran: PNG_1PX.length,
      jenis: "toko_foto",
      tokoId: 7,
      diunggahOleh: fakeUser("admin").id,
    });

    assert.equal(upload.mock.calls[0].arguments[0], "toko/toko-uji/sampul.png");
    assert.deepEqual(update.mock.calls[0].arguments[2], { foto: URL_BARU });
    assert.equal(audit.mock.calls[0].arguments[1]?.aksi, "toko:foto");
    assert.deepEqual(
      remove.mock.calls.map((call) => call.arguments[0]),
      [URL_LAMA],
    );
  });

  it("stempel: berkas bernama stempel.*, URL dicatat di toko.stempel (belum ada stempel lama)", async () => {
    const { update, audit, upload, remove } = arrange();
    await tokoService.updateMedia(fakeUser("admin"), "toko-uji", "stempel", file);

    assert.equal(upload.mock.calls[0].arguments[0], "toko/toko-uji/stempel.png");
    assert.deepEqual(update.mock.calls[0].arguments[2], { stempel: URL_BARU });
    assert.equal(audit.mock.calls[0].arguments[1]?.aksi, "toko:stempel");
    // stempel lama NULL → storage.remove dipanggil dengan null dan mengabaikannya.
    assert.deepEqual(
      remove.mock.calls.map((call) => call.arguments[0]),
      [null],
    );
  });

  it("kompensasi: bila pencatatan ke DB gagal, berkas baru dihapus lagi", async () => {
    const { remove } = arrange({ gagalSimpan: true });
    await assert.rejects(tokoService.updateMedia(fakeUser("admin"), "toko-uji", "foto", file), /koneksi database putus/);
    assert.deepEqual(
      remove.mock.calls.map((call) => call.arguments[0]),
      [URL_BARU],
    );
  });

  it("503 bila public storage token belum diisi", async () => {
    const token = env.blob.publicToken;
    env.blob.publicToken = undefined;
    try {
      await assert.rejects(storage.upload("toko/x/sampul.png", PNG_1PX, "image/png"), { status: 503, code: "STORAGE_UNAVAILABLE" });
    } finally {
      env.blob.publicToken = token;
    }
  });

  it("storage.remove mengabaikan aset bawaan non-Blob", async () => {
    // Tidak melempar & tidak memanggil Vercel: "/images/..." bukan URL Blob.
    await storage.remove("/images/sampul-galeri.jpg");
  });
});

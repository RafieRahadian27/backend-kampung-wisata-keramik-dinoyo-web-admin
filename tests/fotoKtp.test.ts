import { BEARER, fakeUser, loginAs } from "./helpers";
import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { Readable } from "node:stream";
import request from "supertest";
import { createApp } from "../src/app";
import { storage } from "../src/lib/storage";
import { tokoService } from "../src/services/toko.service";
import { tokoRepository } from "../src/repositories/toko.repository";
import assert2 from "node:assert/strict";

const app = createApp();
afterEach(() => mock.restoreAll());

describe("GET /api/toko/:slug/foto-ktp", () => {
  it("standard shop DTO omits private KTP pathname and exposes presence only", async () => {
    const db = { toko: { findMany: async () => [{ id: 1, slug: "toko", nama: "Toko", fotoKtp: "private/secret.png", kategori: [], diperbarui: new Date(), badge: null, stempel: null }] } } as never;
    const [toko] = await tokoRepository.findMany(db, fakeUser("admin"));
    assert2.equal("fotoKtp" in toko, false);
    assert2.equal(toko.hasFotoKtp, true);
  });

  it("restricts access to admin, then streams private bytes without caching", async () => {
    loginAs(fakeUser("pengrajin"));
    assert.equal((await request(app).get("/api/toko/toko-uji/foto-ktp").set(BEARER)).status, 403);

    loginAs(fakeUser("admin"));
    const lookup = mock.method(tokoService, "findFotoKtp", async (slug: string) => {
      assert.equal(slug, "toko-uji");
      return "private/toko-uji/ktp.png";
    });
    const read = mock.method(storage, "readPrivate", async (pathname: string) => {
      assert.equal(pathname, "private/toko-uji/ktp.png");
      return { stream: Readable.toWeb(Readable.from([Buffer.from("private-image")])), blob: { contentType: "image/png" } } as never;
    });

    const res = await request(app).get("/api/toko/toko-uji/foto-ktp").set(BEARER);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, Buffer.from("private-image"));
    assert.equal(res.headers["content-type"], "image/png");
    assert.equal(res.headers["cache-control"], "private, no-store");
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.equal(lookup.mock.callCount(), 1);
    assert.equal(read.mock.callCount(), 1);
  });

  it("returns 404 when no private KTP exists", async () => {
    loginAs(fakeUser("admin"));
    mock.method(tokoService, "findFotoKtp", async () => null);
    const read = mock.method(storage, "readPrivate", async () => { throw new Error("must not access storage"); });
    const res = await request(app).get("/api/toko/toko-uji/foto-ktp").set(BEARER);
    assert.equal(res.status, 404);
    assert.equal(read.mock.callCount(), 0);
  });
});

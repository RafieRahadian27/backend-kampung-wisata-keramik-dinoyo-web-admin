import type { Request, Response } from "express";
import { pickTokoFields } from "../auth/policy";
import { currentUser } from "../middleware/authMiddleware";
import { produkService } from "../services/produk.service";
import { DEFAULT_TOKO, type MediaToko, type TokoFilter, tokoService } from "../services/toko.service";
import type { TokoInput } from "../types";
import { storage } from "../lib/storage";
import { Readable } from "node:stream";

/**
 * Controller hanya membaca input yang sudah lolos `validate()` (req.validated),
 * memanggil service, lalu membalas lewat `res.success()` agar format respons seragam.
 * Fungsi async: error dari query MySQL otomatis diteruskan Express 5 ke errorHandler.
 */
export const tokoController = {
  async list(req: Request, res: Response) {
    const user = currentUser(req);
    const filter = req.validated.query as TokoFilter;
    const [data, ringkasan] = await Promise.all([tokoService.findAll(user, filter), tokoService.ringkasan(user)]);
    res.success(data, { meta: { total: data.length, ringkasan } });
  },

  async detail(req: Request<{ slug: string }>, res: Response) {
    res.success(await tokoService.findBySlug(currentUser(req), req.params.slug));
  },

  async fotoKtp(req: Request<{ slug: string }>, res: Response) {
    const pathname = await tokoService.findFotoKtp(req.params.slug);
    if (!pathname) return res.sendStatus(404);
    const result = await storage.readPrivate(pathname);
    if (!result?.stream) return res.sendStatus(404);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", result.blob.contentType ?? "application/octet-stream");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return new Promise<void>((resolve, reject) => {
      Readable.fromWeb(result.stream as ReadableStream<Uint8Array>).pipe(res).on("finish", resolve).on("error", reject);
    });
  },

  /** Rute bertingkat /toko/:slug/produk — produk milik satu toko. */
  async produk(req: Request<{ slug: string }>, res: Response) {
    const user = currentUser(req);
    const toko = await tokoService.findBySlug(user, req.params.slug);
    const data = await produkService.findAll(user, { tokoSlug: toko.slug });
    res.success(data, { meta: { total: data.length, toko: { slug: toko.slug, nama: toko.nama } } });
  },

  async create(req: Request, res: Response) {
    const user = currentUser(req);
    const body = pickTokoFields(user, req.validated.body) as TokoInput;
    const toko = await tokoService.create(user, { ...DEFAULT_TOKO, ...body });
    res.location(`/api/toko/${toko.slug}`);
    res.success(toko, { status: 201, message: "Toko berhasil ditambahkan" });
  },

  async update(req: Request<{ slug: string }>, res: Response) {
    const user = currentUser(req);
    const toko = await tokoService.update(user, req.params.slug, pickTokoFields(user, req.validated.body));
    res.success(toko, { message: "Perubahan toko tersimpan" });
  },

  /** Handler unggah per jenis media. `req.file` sudah dijamin ada & valid oleh middleware `imageUpload`. */
  uploadMedia(jenis: MediaToko) {
    return async (req: Request<{ slug: string }>, res: Response) => {
      const toko = await tokoService.updateMedia(currentUser(req), req.params.slug, jenis, req.file!);
      res.success(toko, { message: jenis === "foto" ? "Foto sampul toko berhasil diunggah" : "Stempel toko berhasil diunggah" });
    };
  },

  async remove(req: Request<{ slug: string }>, res: Response) {
    await tokoService.remove(currentUser(req), req.params.slug);
    res.success(null, { message: "Toko berhasil dihapus" });
  },
};

import type { Request, Response } from "express";
import { currentUser } from "../middleware/authMiddleware";
import { type Keputusan, pengajuanService } from "../services/pengajuan.service";
import { prisma } from "../lib/prisma";
import { storage } from "../lib/storage";
import { Readable } from "node:stream";
import { IMAGE_EXTENSION } from "../lib/fileType";

export const pengajuanController = {
  async requestCorrection(req: Request<{ slug: string }>, res: Response) {
    const { alasan } = req.validated.body as { alasan: string };
    res.success(await pengajuanService.requestCorrection(currentUser(req), req.params.slug, alasan));
  },

  async replaceKtp(req: Request<{ slug: string }>, res: Response) {
    const user = currentUser(req);
    const file = req.file!;
    // Authorize ownership before storing sensitive document.
    const slug = req.params.slug;
    await pengajuanService.assertCanReplaceKtp(user, slug);
    const uploaded = await storage.upload(`ktp/koreksi/${Date.now()}.${IMAGE_EXTENSION[file.contentType]}`, file.buffer, file.contentType, "private");
    try {
      res.success(await pengajuanService.replaceKtp(user, slug, uploaded.pathname), { message: "KTP pengganti berhasil dikirim" });
    } catch (error) {
      await storage.removePrivate(uploaded.pathname);
      throw error;
    }
  },
  async list(_req: Request, res: Response) {
    const data = await pengajuanService.findAll();
    res.success(data, { meta: { total: data.length } });
  },

  async putuskan(req: Request<{ slug: string }>, res: Response) {
    const { keputusan } = req.validated.body as { keputusan: Keputusan };
    const hasil = await pengajuanService.putuskan(currentUser(req), req.params.slug, keputusan);
    const message = keputusan === "verifikasi" ? "Toko berhasil diverifikasi dan masuk direktori" : "Pengajuan toko ditolak";
    res.success(hasil, { message });
  },

  async fotoKtp(req: Request<{ slug: string }>, res: Response) {
    const row = await prisma.pengajuan.findUnique({ where: { slug: req.params.slug }, select: { fotoKtp: true } });
    if (!row?.fotoKtp) return res.sendStatus(404);
    const pathname = row.fotoKtp;
    const result = await storage.readPrivate(pathname);
    if (!result) return res.sendStatus(404);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", result.blob.contentType ?? "application/octet-stream");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return new Promise<void>((resolve, reject) => {
      if (!result.stream) return resolve();
      Readable.fromWeb(result.stream as ReadableStream<Uint8Array>).pipe(res).on("finish", resolve).on("error", reject);
    });
  },
};

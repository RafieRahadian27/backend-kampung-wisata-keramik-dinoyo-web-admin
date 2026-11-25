import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const analyticsController = {
  async whatsapp(req: Request, res: Response) {
    const { tokoSlug, sumber } = (req.body ?? {}) as { tokoSlug?: string; sumber?: string };
    if (!tokoSlug || tokoSlug.length > 80) return res.status(400).json({ success: false, message: "tokoSlug wajib diisi" });
    await prisma.auditLog.create({ data: { aksi: "whatsapp:klik", target: tokoSlug, detail: (sumber ?? "direktori").slice(0, 255) } });
    return res.status(204).end();
  },
};

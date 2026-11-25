import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { gambarRepository } from "../repositories/gambar.repository";

export const gambarController = {
  /** GET /api/gambar — daftar berkas Vercel Blob yang tercatat di database + ringkasan per jenis. */
  async list(_req: Request, res: Response) {
    const [data, ringkasan] = await Promise.all([gambarRepository.findAll(prisma), gambarRepository.ringkasan(prisma)]);
    const totalByte = ringkasan.reduce((total, item) => total + item.totalByte, 0);
    res.success(data, { meta: { total: data.length, totalByte, ringkasan } });
  },
};

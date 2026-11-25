import type { Request, Response } from "express";
import { currentUser } from "../middleware/authMiddleware";
import { berandaService } from "../services/beranda.service";
import { type PeriodeLaporan, laporanTokoService } from "../services/laporanToko.service";

/** Ringkasan & laporan yang dibatasi ke toko milik pengguna (ABAC). */
export const pengrajinController = {
  async beranda(req: Request, res: Response) {
    res.success(await berandaService.ringkasan(currentUser(req)));
  },

  /** `?periode=7|30|90` (sudah divalidasi `laporanTokoQuerySchema`, default 30). */
  async laporanToko(req: Request, res: Response) {
    const periode = Number(req.validated.query?.periode ?? 30) as PeriodeLaporan;
    res.success(await laporanTokoService.laporan(currentUser(req), periode));
  },
};

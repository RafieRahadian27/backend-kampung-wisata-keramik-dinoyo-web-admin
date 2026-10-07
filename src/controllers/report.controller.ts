import type { Request, Response } from "express";
import { laporanSeed } from "../data/laporan.data";
import { dashboardService } from "../services/dashboard.service";

export const reportController = {
  dashboard(_req: Request, res: Response) {
    res.json({ data: dashboardService.ringkasan() });
  },

  laporan(_req: Request, res: Response) {
    res.json({ data: laporanSeed });
  },
};

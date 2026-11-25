import type { Request, Response } from "express";
import { laporanSeed } from "../data/laporan.data";
import { currentUser } from "../middleware/authMiddleware";
import { dashboardService } from "../services/dashboard.service";
import { HttpError } from "../utils/httpError";

type BagianLaporan = keyof typeof laporanSeed;

export const reportController = {
  async dashboard(req: Request, res: Response) {
    res.success(await dashboardService.ringkasan(currentUser(req)));
  },

  /**
   * Segmen opsional: `/laporan` → seluruh laporan, `/laporan/tren` → satu bagian saja.
   * Bila segmen tidak dikirim, `req.params.bagian` bernilai undefined.
   */
  laporan(req: Request<{ bagian?: string }>, res: Response) {
    const { bagian } = req.params;
    if (!bagian) {
      res.success(laporanSeed);
      return;
    }
    if (!Object.hasOwn(laporanSeed, bagian)) {
      throw new HttpError(404, `Bagian laporan "${bagian}" tidak ada`, {
        details: { tersedia: Object.keys(laporanSeed) },
      });
    }
    res.success(laporanSeed[bagian as BagianLaporan], { meta: { bagian } });
  },
};

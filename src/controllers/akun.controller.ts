import type { Request, Response } from "express";
import { akunService } from "../services/akun.service";
import type { PeranAkun, StatusAkun } from "../types";
import { HttpError } from "../utils/httpError";

const STATUS_VALID: StatusAkun[] = ["aktif", "menunggu", "ditangguhkan"];

export const akunController = {
  list(req: Request, res: Response) {
    const { q, peran, status } = req.query as Record<string, string | undefined>;
    res.json({
      data: akunService.findAll({ q, peran: peran as PeranAkun | undefined, status: status as StatusAkun | undefined }),
      ringkasan: akunService.ringkasan(),
    });
  },

  updateStatus(req: Request<{ id: string }>, res: Response) {
    const { status } = req.body as { status?: StatusAkun };
    if (!status || !STATUS_VALID.includes(status)) {
      throw new HttpError(422, "Status akun tidak valid");
    }
    const akun = akunService.updateStatus(Number(req.params.id), status);
    res.json({ data: akun, message: `Status akun ${akun.nama} diperbarui` });
  },
};

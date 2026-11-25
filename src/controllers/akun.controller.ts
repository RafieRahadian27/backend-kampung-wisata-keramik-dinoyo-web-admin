import type { Request, Response } from "express";
import { currentUser } from "../middleware/authMiddleware";
import { type AkunFilter, akunService, type TokoOtomatis } from "../services/akun.service";
import type { StatusAkun } from "../types";

export const akunController = {
  async list(req: Request, res: Response) {
    const [data, ringkasan] = await Promise.all([akunService.findAll(req.validated.query as AkunFilter), akunService.ringkasan()]);
    res.success(data, { meta: { total: data.length, ringkasan } });
  },

  async updateStatus(req: Request, res: Response) {
    const { status } = req.validated.body as { status: StatusAkun };
    // Akun yang tidak lagi aktif langsung "ditendang": sesinya dicabut dalam transaksi yang sama.
    // Akun yang diaktifkan langsung ditautkan ke tokonya (lihat akunService).
    const { akun, sesiDicabut, toko } = await akunService.updateStatus(currentUser(req), Number(req.params.id), status);
    res.success(akun, { message: `Status akun ${akun.nama} diperbarui.${pesanToko(toko)}`, meta: { sesiDicabut, toko } });
  },
};

function pesanToko(toko: TokoOtomatis | undefined): string {
  if (!toko || toko.aksi === "sudah-terhubung") return "";
  if (toko.aksi === "dilewati") return ` Toko tidak dihubungkan: ${toko.alasan}.`;
  if (toko.aksi === "dibuat") return ` Toko "${toko.nama}" dibuat & dihubungkan (menunggu verifikasi).`;
  return ` Dihubungkan ke toko "${toko.nama}".`;
}

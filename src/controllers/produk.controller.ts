import type { Request, Response } from "express";
import { produkService } from "../services/produk.service";

export const produkController = {
  list(req: Request, res: Response) {
    const { q, kategori, toko } = req.query as Record<string, string | undefined>;
    res.json({
      data: produkService.findAll({ q, kategori, toko }),
      kategori: produkService.kategori(),
      ringkasan: produkService.ringkasan(),
    });
  },

  remove(req: Request<{ id: string }>, res: Response) {
    produkService.remove(Number(req.params.id));
    res.json({ message: "Produk berhasil dihapus dari katalog" });
  },
};

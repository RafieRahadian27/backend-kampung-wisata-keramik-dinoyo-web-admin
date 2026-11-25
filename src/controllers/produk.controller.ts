import type { Request, Response } from "express";
import { currentUser } from "../middleware/authMiddleware";
import { type ProdukFilter, type ProdukInput, produkService } from "../services/produk.service";

export const produkController = {
  async list(req: Request, res: Response) {
    const user = currentUser(req);
    const [data, kategori, ringkasan] = await Promise.all([
      produkService.findAll(user, req.validated.query as ProdukFilter),
      produkService.kategori(user),
      produkService.ringkasan(user),
    ]);
    res.success(data, { meta: { total: data.length, kategori, ringkasan } });
  },

  async hargaPasar(_req: Request, res: Response) {
    res.success(await produkService.hargaPasar());
  },

  async create(req: Request, res: Response) {
    const produk = await produkService.create(currentUser(req), (req.validated.body ?? {}) as unknown as Partial<ProdukInput> as unknown as ProdukInput);
    res.success(produk, { status: 201, message: `Produk "${produk.nama}" berhasil ditambahkan ke katalog` });
  },

  /** `req.params.id` sudah berupa angka positif — dijamin oleh `router.param("id")`. */
  async update(req: Request, res: Response) {
  const produk = await produkService.update(currentUser(req), Number(req.params.id), req.validated.body as unknown as Partial<ProdukInput>);
  res.success(produk, { message: "Produk berhasil diperbarwi" });
},
async uploadFoto(req: Request, res: Response) {
    const produk = await produkService.updateFoto(currentUser(req), Number(req.params.id), req.file!);
    res.success(produk, { message: "Foto produk berhasil diunggah" });
  },

  async remove(req: Request, res: Response) {
    await produkService.remove(currentUser(req), Number(req.params.id));
    res.success(null, { message: "Produk berhasil dihapus dari katalog" });
  },
  async setPublic(req: Request, res: Response) {
    const produk = await produkService.setPublic(currentUser(req), Number(req.params.id), req.validated.body!.aktifPublik as boolean);
    res.success(produk, { message: "Visibilitas produk diperbarui" });
  },
};

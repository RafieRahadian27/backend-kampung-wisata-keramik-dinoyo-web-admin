import type { Request, Response } from "express";
import { tokoService } from "../services/toko.service";
import type { StatusToko, TokoInput } from "../types";
import { HttpError } from "../utils/httpError";
import { validateToko } from "../utils/validateToko";

const DEFAULT_TOKO: Omit<TokoInput, "nama" | "pemilik" | "tahunBerdiri" | "wilayah" | "whatsapp" | "jamBuka"> = {
  nib: "-",
  keterangan: "Pendaftar baru",
  lokasiGang: "-",
  alamat: "",
  koordinat: "-7.9421, 112.6087",
  spesialisasi: "Semi-Porselen",
  kategori: [],
  jumlahProduk: 0,
  deskripsi: "",
  status: "menunggu",
  badge: "baru",
  foto: "/images/sampul-galeri.jpg",
  aktifPublik: false,
  akreditasi: false,
};

export const tokoController = {
  list(req: Request, res: Response) {
    const { q, status, lokasi, kategori } = req.query as Record<string, string | undefined>;
    const data = tokoService.findAll({ q, status: status as StatusToko | undefined, lokasi, kategori });
    res.json({ data, ringkasan: tokoService.ringkasan() });
  },

  detail(req: Request<{ slug: string }>, res: Response) {
    res.json({ data: tokoService.findBySlug(req.params.slug) });
  },

  create(req: Request, res: Response) {
    const body = validateToko(req.body) as TokoInput;
    const toko = tokoService.create({ ...DEFAULT_TOKO, ...body });
    res.status(201).json({ data: toko, message: "Toko berhasil ditambahkan" });
  },

  update(req: Request<{ slug: string }>, res: Response) {
    const body = validateToko(req.body, true);
    const toko = tokoService.update(req.params.slug, body);
    res.json({ data: toko, message: "Perubahan toko tersimpan" });
  },

  remove(req: Request<{ slug: string }>, res: Response) {
    tokoService.remove(req.params.slug);
    res.json({ message: "Toko berhasil dihapus" });
  },

  putuskan(req: Request<{ slug: string }>, res: Response) {
    const { keputusan } = req.body as { keputusan?: string };
    if (keputusan !== "verifikasi" && keputusan !== "tolak") {
      throw new HttpError(422, "Keputusan harus 'verifikasi' atau 'tolak'");
    }
    const hasil = tokoService.putuskanPengajuan(req.params.slug, keputusan);
    const pesan = keputusan === "verifikasi" ? "Toko berhasil diverifikasi" : "Pengajuan toko ditolak";
    res.json({ data: hasil, message: pesan });
  },
};

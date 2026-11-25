import { aiCuratorLimiter } from "../middleware/rateLimiter.js";
import { askAiCurator } from "../services/aiCurator.service.js";
import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();
const publicShopSelect = { slug: true, nama: true, alamat: true, koordinat: true } as const;

function parseCoordinates(value: string): { latitude: number; longitude: number } | null {
  const match = /^\s*(-?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*(-?(?:\d+(?:\.\d*)?|\.\d+))\s*$/.exec(value);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? { latitude, longitude }
    : null;
}

router.get("/shops", async (_req, res) => {
  const shops = await prisma.toko.findMany({
    where: { aktifPublik: true, status: "terverifikasi" },
    select: publicShopSelect,
    orderBy: { nama: "asc" },
    take: 100,
  });
  res.json(shops.map(({ koordinat, ...shop }) => ({ ...shop, koordinat: parseCoordinates(koordinat) })));
});

router.get("/shops/:slug/products", async (req, res) => {
  const products = await prisma.produk.findMany({
    where: { aktifPublik: true, toko: { slug: req.params.slug, aktifPublik: true, status: "terverifikasi" } },
    select: { id: true, nama: true, teknik: true, foto: true, kategori: true, bahan: true, harga: true, stokLabel: true },
    orderBy: { nama: "asc" },
    take: 200,
  });
  res.json(products.map(({ id, nama, teknik, foto, kategori, bahan, harga, stokLabel }) => ({ id, nama, teknik, foto, kategori, bahan, harga, stokLabel })));
});


router.post("/ai-curator", aiCuratorLimiter, async (req, res, next) => {
  try {
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
    if (!prompt) {
      res.status(400).json({ error: "Prompt konsultasi wajib diisi." });
      return;
    }
    if (prompt.length > 500) {
      return res.status(400).json({ error: "Prompt maksimal 500 karakter." });
    }
    const result = await askAiCurator(prompt);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;

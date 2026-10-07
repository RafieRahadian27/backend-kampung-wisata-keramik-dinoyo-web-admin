import { Router } from "express";
import { akunController } from "../controllers/akun.controller";
import { authController } from "../controllers/auth.controller";
import { produkController } from "../controllers/produk.controller";
import { reportController } from "../controllers/report.controller";
import { tokoController } from "../controllers/toko.controller";
import { cacheControl } from "../middleware/cacheControl";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", waktu: new Date().toISOString() });
});

router.post("/auth/login", authController.login);
router.post("/auth/logout", authController.logout);

router.get("/dashboard", cacheControl(30), reportController.dashboard);
router.get("/laporan", cacheControl(60), reportController.laporan);

router.get("/toko", cacheControl(30), tokoController.list);
router.post("/toko", tokoController.create);
router.get("/toko/:slug", cacheControl(30), tokoController.detail);
router.put("/toko/:slug", tokoController.update);
router.delete("/toko/:slug", tokoController.remove);
router.patch("/pengajuan/:slug", tokoController.putuskan);

router.get("/produk", cacheControl(30), produkController.list);
router.delete("/produk/:id", produkController.remove);

router.get("/akun", cacheControl(30), akunController.list);
router.patch("/akun/:id/status", akunController.updateStatus);

export default router;

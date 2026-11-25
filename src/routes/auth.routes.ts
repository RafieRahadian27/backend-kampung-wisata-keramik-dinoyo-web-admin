import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { authenticate } from "../middleware/authMiddleware";
import { noStore } from "../middleware/cacheControl";
import { imageUpload } from "../middleware/upload";
import { registerKtpUploadLimiter } from "../middleware/rateLimiter";
import { env } from "../config/env";
import { loginIpLimiter, loginLimiter, passwordLimiter, registerLimiter } from "../middleware/rateLimiter";
import { requirePermission as can } from "../middleware/requireRole";
import { validate } from "../middleware/validate";
import { loginSchema, passwordSchema, profilSchema, registerSchema } from "../validators";

/**
 * Modul rute autentikasi → di-mount di /api/auth (lihat routes/index.ts, dipasang di app.ts lewat /api).
 * Contoh Multiple Callback: setiap fungsi dijalankan berurutan dan memanggil next()
 * untuk menyerahkan estafet ke fungsi berikutnya; handler terakhir mengirim response.
 *
 *   POST /register  publik  → batasi jumlah daftar → validasi skema → buat akun (status menunggu)
 *   POST /login     publik  → batasi percobaan gagal → validasi skema → cek kata sandi → buat sesi
 *   GET  /me        login   → profil pengguna dari sesi
 *   POST /logout    login   → cabut sesi di database
 */
const router = Router();

router.post("/register/ktp", noStore, registerKtpUploadLimiter, ...imageUpload({ maxBytes: env.blob.maxFotoBytes }), authController.uploadKtp);
router.post("/register", noStore, registerLimiter, validate({ body: registerSchema }), authController.register);
router.post("/login", noStore, loginIpLimiter, loginLimiter, validate({ body: loginSchema }), authController.login);
router.get("/me", authenticate, noStore, authController.me);
router.post("/logout", authenticate, authController.logout);

/**
 * Profil & Keamanan Akun (pengguna sendiri):
 *   GET    /profil    → data akun, skor keamanan, riwayat aktivitas, sesi aktif
 *   PATCH  /profil    → ubah nama tampilan (sapaan)
 *   PATCH  /password  → ganti kata sandi (sesi lain ikut dicabut)
 *   DELETE /sesi      → keluar dari semua perangkat lain
 */
router.get("/profil", authenticate, can("profil:update"), noStore, authController.profil);
router.patch("/profil", authenticate, can("profil:update"), noStore, validate({ body: profilSchema }), authController.ubahProfil);
router.patch("/password", authenticate, can("profil:update"), noStore, passwordLimiter, validate({ body: passwordSchema }), authController.gantiPassword);
router.delete("/sesi", authenticate, can("profil:update"), authController.cabutSesiLain);

export default router;



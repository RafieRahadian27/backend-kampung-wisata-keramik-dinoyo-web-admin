import type { CookieOptions, Request, Response } from "express";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { currentUser } from "../middleware/authMiddleware";
import { authService, type RegisterInput } from "../services/auth.service";
import { IMAGE_EXTENSION } from "../lib/fileType";
import { storage } from "../lib/storage";
import { profilService } from "../services/profil.service";

/**
 * Atribut cookie sesi:
 * - HttpOnly  → tidak bisa dibaca JavaScript di browser (aman dari pencurian via XSS)
 * - Secure    → hanya dikirim lewat HTTPS (aktif di produksi)
 * - SameSite  → Strict: tidak ikut terkirim pada request dari situs lain (menahan CSRF)
 * - Max-Age   → umur cookie sama dengan umur sesi di database
 * - Path      → hanya dikirim ke endpoint /api
 */
const cookieOptions = (maxAgeMs?: number): CookieOptions => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: "strict",
  path: "/api",
  ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
});

export const authController = {
  async login(req: Request, res: Response) {
    const { identifier, password, remember } = req.validated.body as { identifier: string; password: string; remember: boolean };
    const result = await authService.login({
      identifier,
      password,
      remember,
      client: { ipAddress: req.ip, userAgent: req.get("user-agent") },
    });

    res.cookie(env.sessionCookie, result.token, cookieOptions(result.maxAgeMs));
    res.success(
      { token: result.token, expiresAt: result.expiresAt.toISOString(), user: result.user },
      { message: "Login berhasil" },
    );
  },

  async uploadKtp(req: Request, res: Response) {
    const file = req.file!;
    const uploaded = await storage.upload(`ktp/pendaftaran/${Date.now()}.${IMAGE_EXTENSION[file.contentType]}`, file.buffer, file.contentType, "private");
    try {
      const token = randomBytes(32).toString("base64url");
      await prisma.ktpUploadToken.create({ data: { tokenHash: createHash("sha256").update(token).digest("hex"), pathname: uploaded.pathname, expiresAt: new Date(Date.now() + 30 * 60_000) } });
      res.success({ token }, { message: "Foto KTP berhasil diunggah" });
    } catch (error) {
      await storage.removePrivate(uploaded.pathname);
      throw error;
    }
  },

  async register(req: Request, res: Response) {
    const akun = await authService.register(req.validated.body as unknown as RegisterInput);
    res.success(akun, { status: 201, message: "Pendaftaran berhasil. Akun Anda menunggu aktivasi admin paguyuban." });
  },

  me(req: Request, res: Response) {
    const { akunId: _akunId, ...user } = currentUser(req);
    res.success(user);
  },

  async profil(req: Request, res: Response) {
    res.success(await profilService.detail(currentUser(req), req.auth!.token));
  },

  async ubahProfil(req: Request, res: Response) {
    const { sapaan } = req.validated.body as { sapaan: string };
    res.success(await profilService.ubahSapaan(currentUser(req), sapaan), { message: "Nama tampilan berhasil diperbarui" });
  },

  async gantiPassword(req: Request, res: Response) {
    const body = req.validated.body as { passwordLama: string; passwordBaru: string };
    const result = await profilService.gantiPassword(currentUser(req), req.auth!.token, body);
    res.success(result, { message: "Kata sandi berhasil diperbarui" });
  },

  async cabutSesiLain(req: Request, res: Response) {
    const result = await profilService.cabutSesiLain(currentUser(req), req.auth!.token);
    res.success(result, { message: result.sesiDicabut > 0 ? `${result.sesiDicabut} sesi lain telah dikeluarkan` : "Tidak ada sesi lain yang aktif" });
  },

  async logout(req: Request, res: Response) {
    if (req.auth) await authService.logout(req.auth.token);
    res.clearCookie(env.sessionCookie, cookieOptions());
    res.success(null, { message: "Sesi berhasil diakhiri" });
  },
};



import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { adminUser, demoCredentials } from "../data/akun.data";
import { HttpError } from "../utils/httpError";

export const authController = {
  login(req: Request, res: Response) {
    const { identifier, password } = req.body as { identifier?: string; password?: string };
    if (!identifier || !password) {
      throw new HttpError(422, "Email/username dan kata sandi wajib diisi");
    }
    const cocokIdentitas = [demoCredentials.email, demoCredentials.username].includes(identifier.trim().toLowerCase());
    if (!cocokIdentitas || password !== demoCredentials.password) {
      throw new HttpError(401, "Email/username atau kata sandi salah");
    }
    res.json({ data: { token: randomUUID(), user: adminUser }, message: "Login berhasil" });
  },

  logout(_req: Request, res: Response) {
    res.json({ message: "Sesi berhasil diakhiri" });
  },
};

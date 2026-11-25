import "./setup";
import { mock } from "node:test";
import { permissionsOf } from "../src/auth/policy";
import { authService } from "../src/services/auth.service";
import type { AdminUser, Role } from "../src/types";

export function fakeUser(role: Role, overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: role === "admin" ? 1 : 2,
    nama: role === "admin" ? "Admin Uji" : "Pengrajin Uji",
    sapaan: "Uji",
    email: `${role}@uji.test`,
    peran: role,
    role,
    izin: permissionsOf(role),
    tokoSlugs: role === "admin" ? [] : ["toko-uji"],
    ...overrides,
  };
}

/** Sesi apa pun dianggap sah sebagai `user` (menggantikan lookup tabel sessions). */
export function loginAs(user: AdminUser | null) {
  return mock.method(authService, "resolveSession", async () => user);
}

export const BEARER = { Authorization: "Bearer token-uji-rahasia" };

/** PNG 1×1 piksel yang sah (signature PNG + IHDR + IDAT + IEND). */
export const PNG_1PX = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082",
  "hex",
);

export type JsonBody = Record<string, any>;

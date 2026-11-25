import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpError";

/**
 * Handler untuk `router.param(name, handler)`: dijalankan SEKALI setiap kali rute yang
 * memuat parameter tersebut cocok, sebelum handler rute. Validasi parameter jadi terpusat.
 */
export function idParam(_req: Request, _res: Response, next: NextFunction, value: string) {
  if (!/^[1-9]\d{0,9}$/.test(value)) {
    next(new HttpError(400, "ID harus berupa bilangan bulat positif", { code: "INVALID_ID" }));
    return;
  }
  next();
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Slug yang formatnya mustahil ada di database langsung dijawab 404 tanpa query. */
export function slugParam(_req: Request, _res: Response, next: NextFunction, value: string) {
  if (value.length > 80 || !SLUG.test(value)) {
    next(new HttpError(404, `Data dengan slug "${value}" tidak ditemukan`));
    return;
  }
  next();
}

import type { TokoInput } from "../types";
import { HttpError } from "./httpError";

const WAJIB: (keyof TokoInput)[] = ["nama", "pemilik", "tahunBerdiri", "wilayah", "whatsapp", "jamBuka"];

/** Validasi sederhana payload form toko sebelum disimpan. */
export function validateToko(body: Partial<TokoInput>, partial = false): Partial<TokoInput> {
  if (!partial) {
    const kosong = WAJIB.filter((field) => body[field] === undefined || body[field] === "");
    if (kosong.length > 0) {
      throw new HttpError(422, `Field wajib belum diisi: ${kosong.join(", ")}`);
    }
  }
  if (body.nama !== undefined && body.nama.length > 60) {
    throw new HttpError(422, "Nama toko maksimal 60 karakter");
  }
  const tahunSekarang = new Date().getFullYear();
  if (body.tahunBerdiri !== undefined && (body.tahunBerdiri < 1900 || body.tahunBerdiri > tahunSekarang)) {
    throw new HttpError(422, `Tahun berdiri harus di antara 1900 dan ${tahunSekarang}`);
  }
  return body;
}

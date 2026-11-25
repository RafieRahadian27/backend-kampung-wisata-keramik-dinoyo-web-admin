import "./setup";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BATAS_PENGAJUAN_MS, isPengajuanKedaluwarsa, toPengajuan, type PengajuanRow } from "../src/models";
import { parseSchema } from "../src/utils/schema";
import { produkSchema, tokoSchema } from "../src/validators";

const JAM = 60 * 60 * 1000;
const now = new Date("2026-11-18T10:00:00.000Z");
const row = (jamLalu: number, status: PengajuanRow["status"] = "menunggu"): PengajuanRow => ({
  slug: "studio-uji",
  nama: "Studio Uji",
  lokasiGang: "Gang 1",
  pengrajin: "Ibu Uji",
  keahlian: "Putar",
  foto: "/images/x.jpg",
  diajukanPada: new Date(now.getTime() - jamLalu * JAM),
  status,
});

describe("Timer pengajuan toko (batas 3×24 jam)", () => {
  it("masih menunggu sebelum 72 jam; batasWaktu = diajukanPada + 72 jam", () => {
    const hasil = toPengajuan(row(71), now);
    assert.equal(hasil.status, "menunggu");
    assert.equal(new Date(hasil.batasWaktu).getTime() - new Date(hasil.diajukanPada).getTime(), BATAS_PENGAJUAN_MS);
  });

  it("kedaluwarsa tepat di 72 jam atau lebih, walau di database belum sempat ditandai", () => {
    assert.equal(isPengajuanKedaluwarsa(row(72), now), true);
    assert.equal(toPengajuan(row(98), now).status, "kedaluwarsa");
  });

  it("status kedaluwarsa di database tetap kedaluwarsa (tidak 'hidup lagi')", () => {
    assert.equal(isPengajuanKedaluwarsa(row(1, "kedaluwarsa"), now), true);
  });
});

describe("Validasi nama pengrajin & produk", () => {
  const errorField = (schema: typeof tokoSchema, input: Record<string, unknown>, field: string) =>
    parseSchema(schema, input, true).errors.find((e) => e.field === field)?.message;

  it("nama pengrajin: huruf, spasi, gelar bertitik diterima; angka & simbol ditolak", () => {
    assert.equal(errorField(tokoSchema, { pemilik: "H. Suwandi Santoso" }, "pemilik"), undefined);
    assert.equal(errorField(tokoSchema, { pemilik: "Ibu Sri Hartatik" }, "pemilik"), undefined);
    assert.match(errorField(tokoSchema, { pemilik: "Budi123" }, "pemilik") ?? "", /hanya boleh berisi huruf/);
    assert.match(errorField(tokoSchema, { pemilik: "<script>" }, "pemilik") ?? "", /hanya boleh berisi huruf/);
  });

  it("teknik pembuatan harus dari daftar resmi", () => {
    assert.equal(errorField(produkSchema, { teknik: "Putar Tangan" }, "teknik"), undefined);
    assert.match(errorField(produkSchema, { teknik: "asal ketik" }, "teknik") ?? "", /harus salah satu dari/);
  });

  it("nama produk hanya huruf: angka & karakter HTML ditolak", () => {
    assert.equal(errorField(produkSchema, { nama: "Vas Wabi-Sabi (Edisi Khusus)" }, "nama"), undefined);
    assert.match(errorField(produkSchema, { nama: "Guci Pusaka 1" }, "nama") ?? "", /tanpa angka/);
    assert.match(errorField(produkSchema, { nama: "Vas <b>murah</b>" }, "nama") ?? "", /Nama produk hanya boleh/);
  });

  it("bahan tetap boleh angka (suhu bakar), WhatsApp toko hanya digit 08/62", () => {
    assert.equal(errorField(produkSchema, { bahan: "Terracotta Kiln 1100°" }, "bahan"), undefined);
    assert.equal(errorField(tokoSchema, { whatsapp: "081233419901" }, "whatsapp"), undefined);
    assert.match(errorField(tokoSchema, { whatsapp: "08123abc" }, "whatsapp") ?? "", /hanya angka/);
    assert.match(errorField(tokoSchema, { whatsapp: "+62 812-3341-9081" }, "whatsapp") ?? "", /hanya angka/);
  });
});

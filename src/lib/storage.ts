import { BlobError, del, get, put } from "@vercel/blob";
import { env } from "../config/env";
import { logger } from "../logger";
import { HttpError } from "../utils/httpError";

/**
 * Cloud Storage memakai Vercel Blob.
 *
 * Database tidak menyimpan berkasnya, hanya REFERENSI berupa URL publik hasil `put()`
 * (kolom `toko.foto`). Berkas biner tinggal di Blob store sehingga MySQL tetap ringan dan
 * gambar dilayani CDN Vercel langsung ke browser.
 *
 * Token BLOB_READ_WRITE_TOKEN hanya ada di backend — browser tidak pernah memegangnya.
 */

/** Host URL publik Vercel Blob, mis. https://abc123.public.blob.vercel-storage.com/toko/... */
const BLOB_HOST = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//i;

export function isBlobUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && BLOB_HOST.test(url);
}

const storageUnavailable = () =>
  new HttpError(503, "Penyimpanan berkas belum dikonfigurasi atau sedang tidak dapat dihubungi.", { code: "STORAGE_UNAVAILABLE" });

/** Objek (bukan fungsi lepas) agar mudah di-mock dalam tes tanpa memanggil Vercel sungguhan. */
export const storage = {
  isConfigured(): boolean {
    return Boolean(env.blob.publicToken || env.blob.privateToken);
  },

  /**
   * Unggah berkas publik. `addRandomSuffix` membuat URL tiap versi unik, sehingga cache CDN/browser
   * untuk foto lama tidak pernah tertukar dengan foto baru dan URL tidak bisa ditebak.
   */
  async upload(pathname: string, body: Buffer, contentType: string, access: "public" | "private" = "public"): Promise<{ url: string; pathname: string }> {
    const token = access === "private" ? env.blob.privateToken : env.blob.publicToken;
    if (!token) throw storageUnavailable();
    try {
      const blob = await put(pathname, body, {
        access,
        contentType,
        addRandomSuffix: true,
        cacheControlMaxAge: 60 * 60 * 24 * 365,
        token,
      });
      return { url: blob.url, pathname: blob.pathname };
    } catch (error) {
      if (error instanceof BlobError) {
        logger.error({ err: error, pathname }, "Unggah ke Vercel Blob gagal");
        throw storageUnavailable();
      }
      throw error;
    }
  },

  async readPrivate(pathname: string) {
    const token = env.blob.privateToken;
    if (!token) throw storageUnavailable();
    return get(pathname, { access: "private", token: env.blob.privateToken });
  },

  async removePrivate(pathname: string): Promise<void> {
    if (!env.blob.privateToken) return;
    try { await del(pathname, { token: env.blob.privateToken }); }
    catch (error) { logger.warn({ err: error, pathname }, "Gagal menghapus berkas privat yatim"); }
  },

  /**
   * Hapus berkas lama (best effort). Hanya URL Vercel Blob yang dihapus — aset bawaan
   * seperti "/images/sampul-galeri.jpg" diabaikan. Kegagalan hanya dicatat: data utama
   * sudah tersimpan, berkas yatim bisa dibersihkan belakangan.
   */
  async remove(url: string | null | undefined): Promise<void> {
    if (!isBlobUrl(url) || !env.blob.publicToken) return;
    try {
      await del(url, { token: env.blob.publicToken });
    } catch (error) {
      logger.warn({ err: error, url }, "Gagal menghapus berkas lama di Vercel Blob");
    }
  },
};




import type { ImageType } from "../lib/fileType";
import type { AuthenticatedUser } from "./index";

/**
 * Augmentasi objek Request & Response Express (declaration merging).
 * Properti di bawah ini disisipkan oleh middleware, lalu bisa dipakai dengan aman
 * (bertipe) di controller tanpa casting.
 */

export interface RequestContext {
  /** ID unik per request — dikirim balik di header X-Request-Id untuk penelusuran log. */
  requestId: string;
  startedAt: number;
}

export interface ValidatedInput {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
}

/** Berkas unggahan yang sudah lolos pemeriksaan tipe, ukuran, dan magic bytes. */
export interface UploadedFile {
  buffer: Buffer;
  contentType: ImageType;
  size: number;
}

export interface SuccessOptions {
  status?: number;
  message?: string;
  meta?: Record<string, unknown>;
}

declare global {
  namespace Express {
    interface Request {
      /** Disisipkan oleh `requestContext`. */
      context: RequestContext;
      /** Disisipkan oleh `authenticate`: pengguna terverifikasi dari token sesi (dibaca `requireRole`). */
      user?: AuthenticatedUser;
      /** Disisipkan oleh `authenticate`: pengguna + token mentah (dipakai logout untuk mencabut sesi). */
      auth?: { user: AuthenticatedUser; token: string };
      /** Disisipkan oleh `validate`: input yang sudah lolos skema (bersih & bertipe). */
      validated: ValidatedInput;
      /** Disisipkan oleh `imageUpload`: berkas gambar yang sudah divalidasi. */
      file?: UploadedFile;
    }
    interface Response {
      /** Disisipkan oleh `responseFormatter`: bungkus data dalam format JSON standar. */
      success<T>(data: T, options?: SuccessOptions): Response;
    }
  }
}

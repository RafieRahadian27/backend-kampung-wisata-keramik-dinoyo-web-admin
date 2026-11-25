/**
 * Validasi isi berkas lewat "magic bytes" (tanda tangan di awal berkas).
 *
 * Header Content-Type dan ekstensi nama berkas dikirim klien sehingga bisa dipalsukan
 * (mis. skrip .html yang dinamai foto.jpg). Server memeriksa byte pertamanya sendiri dan
 * hanya menerima bila isinya sungguh JPEG/PNG/WebP DAN sama dengan tipe yang diklaim.
 */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const IMAGE_EXTENSION: Record<ImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const startsWith = (buffer: Buffer, bytes: number[], offset = 0) => bytes.every((byte, index) => buffer[offset + index] === byte);

export function detectImageType(buffer: Buffer): ImageType | undefined {
  if (buffer.length < 12) return undefined;
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // WebP = wadah RIFF: "RIFF" <4 byte ukuran> "WEBP".
  if (startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return undefined;
}

export function isAllowedImageType(value: string | undefined): value is ImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(value ?? "");
}

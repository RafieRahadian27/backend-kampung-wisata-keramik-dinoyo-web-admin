import { randomBytes, scrypt, scryptSync, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Hash kata sandi memakai scrypt (bawaan Node, tanpa dependensi tambahan).
 * Format tersimpan: `scrypt$<salt base64url>$<hash base64url>`.
 * Kata sandi asli tidak pernah disimpan — hanya hash + salt acak per pengguna.
 */
const KEY_LENGTH = 64;
const OPTIONS: ScryptOptions = { N: 16384, r: 8, p: 1 };

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, OPTIONS, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** Versi sinkron, hanya untuk membuat data seed saat server mulai. */
export function hashPasswordSync(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH, OPTIONS);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

/** Versi async untuk request (pendaftaran) agar event loop tidak terblokir. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltText, hashText] = stored.split("$");
  if (algo !== "scrypt" || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, "base64url");
  const actual = await derive(password, Buffer.from(saltText, "base64url"));
  // timingSafeEqual: perbandingan waktu-konstan agar tidak bocor lewat timing attack.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

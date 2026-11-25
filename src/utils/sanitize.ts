/**
 * Transformasi field pada response: buang kolom sensitif dari output akhir.
 * Repository sudah tidak memilih kolom ini, tetapi lapisan ini menjadi pengaman
 * terakhir (defense in depth) bila suatu saat ada baris mentah yang lolos.
 */
const SENSITIVE_KEYS = new Set(["password", "passwordHash", "password_hash", "tokenHash", "token_hash"]);

export function stripSensitive<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripSensitive) as T;
  if (value instanceof Date || value === null || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    if (!SENSITIVE_KEYS.has(key)) output[key] = stripSensitive(field);
  }
  return output as T;
}

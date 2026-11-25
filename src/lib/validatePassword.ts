/**
 * Aturan kekuatan kata sandi untuk pendaftaran (sumber kebenaran; frontend memakai aturan yang
 * sama di `frontend/src/lib/validation/auth.ts` hanya untuk umpan balik cepat).
 *
 * Login sengaja TIDAK memakai aturan ini: kata sandi lama yang dibuat sebelum aturan diperketat
 * harus tetap bisa dipakai masuk.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 100;

interface PasswordContext {
  username?: unknown;
  email?: unknown;
}

/** Bagian identitas yang tidak boleh muncul di kata sandi (mis. "siti" pada "Siti2024"). */
function personalParts({ username, email }: PasswordContext): string[] {
  const parts = [typeof username === "string" ? username : "", typeof email === "string" ? email.split("@")[0] : ""];
  return parts.map((part) => part.trim().toLowerCase()).filter((part) => part.length >= 4);
}

/** @returns pesan kesalahan pertama, atau `undefined` bila kata sandi memenuhi semua syarat. */
export function validatePassword(password: unknown, context: PasswordContext = {}): string | undefined {
  if (typeof password !== "string" || password === "") return "Kata sandi wajib diisi";
  if (password.length < PASSWORD_MIN) return `Kata sandi minimal ${PASSWORD_MIN} karakter`;
  if (password.length > PASSWORD_MAX) return `Kata sandi maksimal ${PASSWORD_MAX} karakter`;
  if (/\s/.test(password)) return "Kata sandi tidak boleh mengandung spasi";
  if (!/[a-z]/.test(password)) return "Kata sandi harus mengandung huruf kecil";
  if (!/[A-Z]/.test(password)) return "Kata sandi harus mengandung huruf besar";
  if (!/\d/.test(password)) return "Kata sandi harus mengandung angka";

  const lower = password.toLowerCase();
  if (personalParts(context).some((part) => lower.includes(part))) return "Kata sandi tidak boleh memuat username atau nama email Anda";
  return undefined;
}

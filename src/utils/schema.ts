/**
 * Validator skema kecil (tanpa dependensi) untuk memastikan input mentah dari klien
 * sesuai tipe data, kewajiban isi, dan aturan formatnya sebelum masuk ke business logic.
 *
 * - Field yang tidak ada di skema dibuang (whitelist) → mencegah mass assignment.
 * - String di-trim, angka/boolean dari query string di-coerce ("2024" → 2024).
 * - Semua pelanggaran dikumpulkan sekaligus agar klien bisa menampilkan semuanya.
 */
interface BaseRule {
  label?: string;
  required?: boolean;
}

/** Pemeriksaan tambahan yang tidak cukup dengan regex; menerima seluruh input agar bisa membandingkan field lain. */
type StringCheck = (value: string, input: Record<string, unknown>) => string | undefined;

export type Rule =
  | (BaseRule & {
      type: "string";
      min?: number;
      max?: number;
      pattern?: RegExp;
      patternMessage?: string;
      enum?: readonly string[];
      check?: StringCheck;
      default?: string;
    })
  | (BaseRule & { type: "number"; integer?: boolean; min?: number; max?: number | (() => number); default?: number })
  | (BaseRule & { type: "boolean"; default?: boolean })
  | (BaseRule & { type: "array"; maxItems?: number; itemMax?: number; default?: string[] });

export type Schema = Record<string, Rule>;

export interface FieldError {
  field: string;
  message: string;
}

const isEmpty = (value: unknown) => value === undefined || value === null || (typeof value === "string" && value.trim() === "");

function checkField(field: string, rule: Rule, raw: unknown, source: Record<string, unknown>): { value?: unknown; error?: string } {
  const label = rule.label ?? field;

  switch (rule.type) {
    case "string": {
      if (typeof raw !== "string") return { error: `${label} harus berupa teks` };
      const value = raw.trim();
      if (rule.min !== undefined && value.length < rule.min) return { error: `${label} minimal ${rule.min} karakter` };
      if (rule.max !== undefined && value.length > rule.max) return { error: `${label} maksimal ${rule.max} karakter` };
      if (rule.enum && !rule.enum.includes(value)) return { error: `${label} harus salah satu dari: ${rule.enum.join(", ")}` };
      if (rule.pattern && value !== "" && !rule.pattern.test(value)) return { error: rule.patternMessage ?? `Format ${label} tidak valid` };
      const checkError = rule.check?.(value, source);
      if (checkError) return { error: checkError };
      return { value };
    }
    case "number": {
      // Teks hanya boleh berisi digit desimal: "37" lolos, "tiga tujuh"/"0x25"/"1e2" ditolak.
      if (typeof raw === "string" && !/^-?\d+(\.\d+)?$/.test(raw.trim())) return { error: `${label} hanya boleh berisi angka` };
      const value = typeof raw === "string" ? Number(raw) : raw;
      if (typeof value !== "number" || !Number.isFinite(value)) return { error: `${label} harus berupa angka` };
      if (rule.integer && !Number.isInteger(value)) return { error: `${label} harus bilangan bulat` };
      const max = typeof rule.max === "function" ? rule.max() : rule.max;
      if ((rule.min !== undefined && value < rule.min) || (max !== undefined && value > max)) {
        return { error: `${label} harus di antara ${rule.min ?? "-∞"} dan ${max ?? "∞"}` };
      }
      return { value };
    }
    case "boolean": {
      if (typeof raw === "boolean") return { value: raw };
      if (raw === "true" || raw === "false") return { value: raw === "true" };
      return { error: `${label} harus bernilai true/false` };
    }
    case "array": {
      if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) return { error: `${label} harus berupa daftar teks` };
      const value = [...new Set(raw.map((item: string) => item.trim()).filter(Boolean))];
      if (rule.maxItems !== undefined && value.length > rule.maxItems) return { error: `${label} maksimal ${rule.maxItems} item` };
      if (rule.itemMax !== undefined && value.some((item) => item.length > rule.itemMax!)) {
        return { error: `Setiap ${label} maksimal ${rule.itemMax} karakter` };
      }
      return { value };
    }
  }
}

/**
 * @param partial  true untuk PUT/PATCH parsial: field yang tidak dikirim dilewati dan
 *                 nilai default tidak diisikan; field yang dikirim tetap harus valid.
 */
export function parseSchema(schema: Schema, input: unknown, partial = false) {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const value: Record<string, unknown> = {};
  const errors: FieldError[] = [];

  for (const [field, rule] of Object.entries(schema)) {
    const raw = source[field];
    if (isEmpty(raw)) {
      // Mode parsial: field wajib boleh tidak dikirim, tetapi tidak boleh dikirim kosong.
      if (rule.required && (!partial || raw !== undefined)) errors.push({ field, message: `${rule.label ?? field} wajib diisi` });
      else if (!partial && rule.default !== undefined) value[field] = rule.default;
      else if (raw === "" && rule.type === "string" && !rule.required) value[field] = "";
      continue;
    }
    const result = checkField(field, rule, raw, source);
    if (result.error) errors.push({ field, message: result.error });
    else value[field] = result.value;
  }

  return { value, errors };
}

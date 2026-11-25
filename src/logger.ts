import pino, { type DestinationStream, type LoggerOptions } from "pino";
import { env } from "./config/env";

/**
 * Logger terstruktur (JSON per baris) untuk seluruh backend.
 *
 * Kenapa JSON, bukan console.log biasa? Log bisa dicari & difilter mesin (mis. semua baris
 * dengan requestId tertentu), dan setiap baris membawa konteks yang sama: level, waktu, requestId.
 *
 * Data rahasia TIDAK BOLEH masuk log. `redact` menyensor path di bawah ini di mana pun muncul,
 * sehingga walau suatu saat ada kode yang tidak sengaja me-log header/body, nilainya tetap tersamar.
 */
export const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers[\"set-cookie\"]",
  "*.password",
  "*.passwordHash",
  "*.token",
  "*.tokenHash",
  "*.authorization",
  "*.cookie",
];

export const loggerOptions: LoggerOptions = {
  level: env.logLevel,
  base: { service: "dinoyo-admin-api" },
  redact: { paths: REDACT_PATHS, censor: "[DISENSOR]" },
  timestamp: pino.stdTimeFunctions.isoTime,
};

/** Dipakai tes untuk menangkap output log ke stream sendiri (dengan level yang bisa ditimpa). */
export function createLogger(destination?: DestinationStream, overrides: LoggerOptions = {}) {
  const options = { ...loggerOptions, ...overrides };
  return destination ? pino(options, destination) : pino(options);
}

/**
 * Saat development log dicetak berwarna & mudah dibaca (pino-pretty); production tetap JSON
 * agar bisa dikirim ke layanan log. pino-pretty hanya devDependency, jadi tidak dimuat di production.
 */
function prettyInDevelopment() {
  if (env.isProduction || env.isTest) return undefined;
  try {
    require.resolve("pino-pretty");
    return pino.transport({ target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname,service" } });
  } catch {
    return undefined;
  }
}

export const logger = createLogger(prettyInDevelopment());

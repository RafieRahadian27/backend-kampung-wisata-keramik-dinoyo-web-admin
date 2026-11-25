import helmet from "helmet";
import { env } from "../config/env";

/**
 * Header keamanan untuk SETIAP balasan, memakai Helmet.
 * API ini hanya mengembalikan JSON, jadi kebijakannya bisa dibuat seketat mungkin.
 *
 * - Content-Security-Policy  : respons JSON tidak memuat resource apa pun & tidak boleh di-iframe
 * - X-Content-Type-Options   : nosniff — browser tidak menebak tipe konten
 * - X-Frame-Options          : DENY — cegah clickjacking
 * - Referrer-Policy          : no-referrer
 * - Cross-Origin-Resource-Policy: same-site — respons tidak bisa disematkan situs lain
 * - Strict-Transport-Security: hanya di production (bermakna bila API dilayani lewat HTTPS)
 * - X-Powered-By             : dihapus Helmet (jangan umumkan teknologi server)
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
  },
  frameguard: { action: "deny" },
  referrerPolicy: { policy: "no-referrer" },
  crossOriginResourcePolicy: { policy: "same-site" },
  strictTransportSecurity: env.isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
});

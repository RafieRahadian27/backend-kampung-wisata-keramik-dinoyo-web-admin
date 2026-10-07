import "dotenv/config";

export const env = {
  port: Number(process.env.PORT ?? 4000),
  // Bisa lebih dari satu origin, pisahkan dengan koma.
  clientOrigins: (process.env.CLIENT_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean),
  isProduction: process.env.NODE_ENV === "production",
};

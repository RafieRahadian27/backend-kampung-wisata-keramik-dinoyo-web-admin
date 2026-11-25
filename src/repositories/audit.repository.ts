import type { Db } from "../lib/prisma";

export interface AuditEntry {
  userId: number | null;
  aksi: string;
  target: string;
  detail?: string;
}

/** Jejak audit selalu ditulis dengan klien transaksi yang sama dengan perubahan datanya. */
export const auditRepository = {
  async whatsappClicks(db: Db, tokoSlugs: string[], since: Date, until = new Date()) {
    if (!tokoSlugs.length) return [];
    return db.auditLog.findMany({
      where: { aksi: "whatsapp:klik", target: { in: tokoSlugs }, createdAt: { gte: since, lt: until } },
      select: { target: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  },

  async insert(db: Db, entry: AuditEntry) {
    await db.auditLog.create({
      data: { userId: entry.userId, aksi: entry.aksi, target: entry.target, detail: entry.detail ?? "", createdAt: new Date() },
    });
  },

  /**
   * Aktivitas terbaru yang relevan bagi pengguna: tindakannya sendiri ATAU tindakan orang lain
   * (mis. admin memverifikasi) terhadap toko miliknya — dicocokkan lewat slug/nama toko di kolom target.
   */
  async recentFor(db: Db, userId: number, targets: string[] = [], take = 10) {
    const rows = await db.auditLog.findMany({
      where: { OR: [{ userId }, ...(targets.length ? [{ target: { in: targets } }] : [])] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      select: { id: true, userId: true, aksi: true, target: true, detail: true, createdAt: true, user: { select: { sapaan: true } } },
    });
    return rows.map((row) => ({
      id: String(row.id),
      aksi: row.aksi,
      target: row.target,
      detail: row.detail,
      createdAt: row.createdAt,
      oleh: row.userId === userId ? "Anda" : (row.user?.sapaan ?? "Sistem"),
    }));
  },

  /** Waktu terakhir pengguna melakukan aksi tertentu (mis. ganti kata sandi), atau null. */
  async lastByUser(db: Db, userId: number, aksi: string) {
    const row = await db.auditLog.findFirst({ where: { userId, aksi }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { createdAt: true } });
    return row?.createdAt ?? null;
  },

  async countByUser(db: Db, userId: number) {
    return db.auditLog.count({ where: { userId } });
  },

  async latest(db: Db, aksi: string) {
    const row = await db.auditLog.findFirst({
      where: { aksi },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { target: true, createdAt: true, user: { select: { sapaan: true } } },
    });
    return row ? { target: row.target, createdAt: row.createdAt, oleh: row.user?.sapaan ?? null } : undefined;
  },
};

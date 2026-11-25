# Backend — Dinoyo Admin API (Express.js 5 + TypeScript + Prisma)

REST API untuk panel admin Kampung Wisata Keramik Dinoyo. Data disimpan di MySQL/MariaDB lewat **Prisma ORM 7**
(driver adapter `@prisma/adapter-mariadb`). Struktur tabel dikelola dengan **migrasi Prisma**.
Daftar endpoint, format respons, dan pemetaan materi ada di [README utama](../README.md#endpoint-api).

```bash
# 1. Nyalakan MySQL (XAMPP Control Panel → MySQL → Start)
npm install            # juga menjalankan `prisma generate` (Prisma Client → src/generated/prisma)
cp .env.example .env   # DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_CONNECTION_LIMIT, ...
npm run db:reset       # hapus & buat ulang tabel lewat migrasi + isi data demo. Menghapus data lama!
npm run dev            # watch mode via tsx → http://localhost:4000/api
npm run build          # prisma generate + kompilasi ke dist/
npm start              # jalankan hasil build
```

Perintah database:

| Perintah | Kegunaan |
| --- | --- |
| `npm run db:migrate -- --name <nama>` | Setelah mengubah `prisma/schema.prisma`: buat file migrasi baru, jalankan, dan generate ulang client |
| `npm run db:deploy` | Jalankan migrasi yang belum diterapkan (aman untuk data yang ada; dipakai di produksi) |
| `npm run db:status` | Lihat migrasi mana yang sudah/belum dijalankan |
| `npm run db:seed` | Isi ulang data demo ([`prisma/seed.ts`](prisma/seed.ts)) |
| `npm run db:reset` | `prisma migrate reset` + seed — **semua data hilang**, hanya untuk database development |
| `npm run db:studio` | Buka Prisma Studio (GUI untuk melihat/mengubah data) |

**Sudah punya database `dinoyo_admin` dari `schema.sql` lama?** Strukturnya identik dengan migrasi `init`,
jadi data bisa dipertahankan (*baseline*):

```bash
npx prisma migrate resolve --applied 20261104000000_init   # tandai migrasi awal sebagai sudah dijalankan
npm run db:deploy                                         # jalankan migrasi berikutnya (login_tracking)
```

Alur kode:

```text
app.ts (middleware global)
  → routes/*.routes.ts (authenticate, requireRole/requirePermission, rateLimiter, validate, cacheControl)
    → controllers/ (baca req.validated, balas lewat res.success)
      → services/ (logika bisnis, withTransaction = prisma.$transaction)
        → repositories/ (Prisma Client, transformasi model → JSON API)
          → lib/prisma.ts (PrismaClient + adapter MariaDB, connection pool)
            → MySQL/MariaDB (port 3306)
```

Error dari lapisan mana pun (termasuk Promise yang reject dan error Prisma `P2002`/`P2025`) ditangani terpusat oleh
`middleware/errorHandler.ts`.

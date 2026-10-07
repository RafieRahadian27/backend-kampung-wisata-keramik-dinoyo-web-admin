# Backend — Dinoyo Admin API (Express.js 5 + TypeScript)

REST API untuk panel admin Kampung Wisata Keramik Dinoyo. Data disimpan in-memory (seed di `src/data`) dan kembali ke data awal setiap
server di-restart. Daftar endpoint lengkap ada di [README utama](../README.md#endpoint-api).

```bash
npm install
cp .env.example .env   # PORT=4000, CLIENT_ORIGIN=http://localhost:3000
npm run dev            # watch mode via tsx → http://localhost:4000/api
npm run build          # kompilasi ke dist/
npm start              # jalankan hasil build
```

Alur kode: `routes/` → `controllers/` → `services/` → `data/`, dengan `middleware/errorHandler.ts` sebagai penangan error terpusat.

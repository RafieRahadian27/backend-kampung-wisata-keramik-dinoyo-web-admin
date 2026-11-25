import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

export interface AiCuratorResult {
  title: string;
  category: string;
  ceramic_recommendation: string;
  cultural_significance: string;
  estimated_budget: string;
  care_tips: string;
  recommended_shops: string[];
  key_points: string[];
  raw_json?: string;
}

export async function askAiCurator(userQuery: string): Promise<AiCuratorResult> {
  const apiKey = env.gemini.apiKey;
  if (!apiKey) {
    throw new Error("Layanan AI belum dikonfigurasi (GEMINI_API_KEY belum diisi di server).");
  }

  const [shops, products] = await Promise.all([
    prisma.toko.findMany({
      where: { aktifPublik: true, status: "terverifikasi" },
      select: { nama: true, spesialisasi: true, alamat: true, lokasiGang: true },
      take: 20,
    }),
    prisma.produk.findMany({
      where: { aktifPublik: true, toko: { aktifPublik: true, status: "terverifikasi" } },
      select: { nama: true, kategori: true, bahan: true, teknik: true, harga: true, toko: { select: { nama: true } } },
      take: 30,
    }),
  ]);

  const contextToko = shops.map((s) => `- ${s.nama} (${s.spesialisasi || "Keramik Dinoyo"}, Lokasi: ${s.lokasiGang})`).join("\n");
  const contextProduk = products.map((p) => `- ${p.nama} (${p.kategori}, ${p.bahan}, teknik ${p.teknik}, harga Rp${p.harga.toLocaleString("id-ID")}) di ${p.toko.nama}`).join("\n");
  const prompt = [
    "[ROLE]",
    "Kamu adalah Kurator Seni Kriya dan Konsultan Budaya Senior Kampung Wisata Keramik Dinoyo Malang. Tugasmu adalah memberikan wawasan seni, rekomendasi karya keramik, filosofi budaya, estimasi harga, dan panduan belanja atau workshop edukasi untuk pengunjung, kolektor, atau pelajar.",
    "",
    "[DATA FAKTUAL TOKO DAN PRODUK DINOYO AKTIF]",
    "Berikut adalah toko dan produk asli yang sedang aktif di Kampung Wisata Keramik Dinoyo. UTAMAKAN merekomendasikan nama toko dan karya dari daftar berikut:",
    "--- DAFTAR TOKO ---",
    contextToko || "(Toko Dinoyo umum)",
    "--- DAFTAR PRODUK UNGGULAN ---",
    contextProduk || "(Produk Dinoyo umum)",
    "",
    "[CONSTRAINT]",
    "Analisis WAJIB faktual berbasis kekayaan tradisi Dinoyo (semi-porselen, gerabah tanah liat, glasir suhu tinggi 1200 Celsius, motif miring khas Dinoyo, perpaduan seni Tiongkok-Jawa sejak 1930). Gunakan Bahasa Indonesia yang ramah, kultural, dan informatif. Keluaran WAJIB HANYA berupa JSON valid sesuai output schema tanpa pembuka, penutup, atau tanda markdown.",
    "",
"[OUTPUT SCHEMA]",
    "{\n  \"title\": \"Judul insight menarik\",\n  \"category\": \"Semi-Porselen | Gerabah | Galeri Suvenir | Workshop Edukasi | Porselen Halus\",\n  \"ceramic_recommendation\": \"Rekomendasi jenis keramik spesifik beserta alasan estetika dan fungsional\",\n  \"cultural_significance\": \"Makna filosofis, sejarah atau keunikan teknik Dinoyo\",\n  \"estimated_budget\": \"Rentang perkiraan harga dalam Rupiah, misal: Rp 75.000 - Rp 350.000\",\n  \"care_tips\": \"Tips perawatan atau pemeliharaan keramik tersebut\",\n  \"recommended_shops\": [\n    \"1-3 nama toko/sanggar di Dinoyo yang cocok\"\n  ],\n  \"key_points\": [\n    \"3 poin kesimpulan ringkas\"\n  ]\n}",
    "",
    "[USER REQUEST]",
    userQuery.trim(),
  ].join("\n");
  let response: any;
  let lastErrMsg = "";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.gemini.model}:generateContent?key=${apiKey}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: "application/json",
          },
        }),
      });

      if (response.ok) break;
      lastErrMsg = await response.text();
      if (response.status === 503 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
        continue;
      }
      break;
    } catch (err: any) {
      lastErrMsg = err.message;
    }
  }
  if (!response || !response.ok) {
    throw new Error(`Gemini API error: ${lastErrMsg}`);
  }

  const data = await response.json();
  const candidates = data && data.candidates;
  const firstPart = candidates && candidates[0] && candidates[0].content && candidates[0].content.parts && candidates[0].content.parts[0];
  const rawText = (firstPart && firstPart.text) || "{}";

  let parsed;
  try {
    let cleaned = rawText.trim();
    if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
    if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
    if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
    parsed = JSON.parse(cleaned.trim());
    if (Array.isArray(parsed) && parsed.length > 0) parsed = parsed[0];
  } catch {
    parsed = {};
  }

  return {
    title: parsed.title || "Rekomendasi Insight Keramik Dinoyo",
    category: parsed.category || "Semi-Porselen",
    ceramic_recommendation: parsed.ceramic_recommendation || "Koleksi Keramik Dinoyo",
    cultural_significance: parsed.cultural_significance || "Warisan budaya keramik Dinoyo sejak 1930.",
    estimated_budget: parsed.estimated_budget || "Hubungi Pengrajin",
    care_tips: parsed.care_tips || "Bersihkan dengan kain microfiber halus.",
    recommended_shops: Array.isArray(parsed.recommended_shops) && parsed.recommended_shops.length > 0
      ? parsed.recommended_shops
      : shops.slice(0, 2).map((s) => s.nama),
    key_points: Array.isArray(parsed.key_points) && parsed.key_points.length > 0
      ? parsed.key_points
      : ["Produk asli pengrajin Dinoyo dengan glasir suhu tinggi", "Mengandung filosofi motif miring yang anggun", "Mendukung keberlanjutan UMKM lokal Malang"],
    raw_json: rawText,
  };
}

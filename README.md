# 🌊 Arus — skor peluang saham IDX yang jujur

> **Untuk investor ritel IDX yang kebanjiran data tapi kekurangan keyakinan, Arus memberi setiap saham satu skor peluang yang divalidasi ke data historis, menjelaskan alasannya dalam bahasa biasa, dan hanya mempublikasikan model yang lolos uji.**

Sectors Hackathon 2026 · Track 03 — Market Intelligence · Data: [Sectors API](https://sectors.app)

---

## Apa yang dilakukan Arus

Setiap hari bursa Arus menilai 120 saham paling aktif di BEI dan menjawab satu pertanyaan:

**“Dari 100 kondisi di masa lalu yang mirip saham ini hari ini, berapa yang berakhir lebih baik daripada separuh saham lain?”**

- **Skor X/100** dengan 50 = lempar koin, untuk hari bursa berikutnya. Model 1 bulan juga dilatih setiap hari, tapi baru dipublikasikan kalau lolos validasi.
- **Lima tingkat yang mudah dibaca:** Sangat diunggulkan · Diunggulkan · Netral · Kurang diunggulkan · Waspada.
- **Alasan dalam bahasa biasa** untuk setiap skor (mis. “Pergerakan tenang — di data uji, saham yang tenang lebih sering unggul”).
- **Level penting harian:** gerak normal harian, batas bawah/atas 1 bulan, batas sinyal batal.
- **Bukti tambahan yang sengaja tidak dicampur ke skor:** jejak bandar (broker institusi vs ritel), fundamental vs rekan sektor, transaksi orang dalam, kejadian tak biasa.
- **Agen harian + bot Telegram** yang mengambil data baru, belajar ulang, **menilai dirinya sendiri**, lalu mengirim ringkasan.

## Kenapa berbeda

Banyak laporan saham menulis “Confidence 78%” tanpa pernah menguji dari mana angka itu. Arus melakukan sebaliknya:

| | Skor biasa | Arus |
|---|---|---|
| Asal angka | Bobot buatan manusia | Dipelajari dari data ±15 bulan |
| Diuji? | Jarang | Walk-forward seperti dipakai sungguhan, dengan jeda anti-bocor |
| Arti “56” | Tidak jelas | 56 dari 100 kejadian serupa memang unggul (dikalibrasi) |
| Saat bukti lemah | Tetap terdengar yakin | Skor dekat 50, label “Netral” |
| Periode gagal | Disembunyikan | Ditampilkan di halaman Bukti |
| Model yang gagal uji | Tetap ditampilkan | Otomatis tidak dipublikasikan sampai lolos lagi |

## Hasil uji (jujur, out-of-sample)

| Jangka waktu | Periode di atas acak | “Sangat diunggulkan” unggul | “Waspada” unggul |
|---|---|---|---|
| Besok (Des 2025 – Okt 2026) | **7 dari 10** | 52 dari 100 | 47 dari 100 |
| 1 bulan (Jan – Sep 2026) | 4 dari 8 | 50 dari 100 | 59 dari 100 — **terbalik** |

**Skor besok:** sinyalnya nyata tapi tipis (AUC 0,513), konsisten di hampir semua bulan. Arus paling bisa diandalkan sebagai **saringan pertama**: 53 dari 100 saham bertanda Waspada memang berakhir di separuh bawah keesokan harinya. Keunggulan sekecil ini habis dimakan biaya kalau dipakai beli-jual setiap hari (simulasi: −29% terhadap IHSG setelah biaya), jadi gunakan sebagai penyaring, bukan strategi.

**Model 1 bulan: dalam evaluasi, tidak dipublikasikan.** Versi awal hanya diuji April–September 2026 dan tampak +11% di atas IHSG. Setelah histori diperpanjang ke Juli 2025, Januari–Maret 2026 ternyata terbalik (AUC 0,32–0,45) dan keunggulannya hilang (AUC total 0,479). Dugaan “hanya gagal saat reli lebar” kami uji dengan aturan breadth yang ditetapkan sebelum melihat hasil, dan tidak terbukti. Kalibrasinya dibuat monoton, dan situs serta bot hanya menampilkan horizon yang lolos validasi (`metrics.proven`). Model 1 bulan tetap dilatih dan diuji setiap hari; begitu lolos, ia muncul kembali dengan sendirinya. Hasil ujinya tetap dibuka di bagian Tata kelola model pada halaman Bukti.

Detail lengkap (AUC, kalibrasi, stabilitas per periode) ada di halaman **Bukti**.

## Arsitektur

```
Sectors API ──► client.py (cache permanen + meteran kredit + throttle)
                    │
                    ▼
               ingest.py  ──► SQLite (data/warehouse.db, tidak di-commit)
                    │
                    ▼
   features.py (14 kondisi kausal, persentil harian per saham)
                    │
                    ▼
   model.py (regresi logistik L2 · walk-forward ber-jeda · kalibrasi Platt) × 2 horizon
                    │
                    ▼
   build.py ──► snapshot/ + web/src/data/  (hasil turunan saja, tanpa API key)
                    │                   │
                    ▼                   ▼
   agent.py (harian: refresh,      web/ (Next.js statis, ID/EN, responsif)
   belajar ulang, rapor, Telegram)
```

## Data Sectors yang dipakai

`/v2/daily/{symbol}` · `/v2/foreign-flow/{symbol}` · `/v2/foreign-flow/` · `/v2/index-daily/ihsg` · `/v2/companies` (screener + JII70) · `/v2/broker-summary/{symbol}/top` · `/v2/brokers` · `/v2/filings` · `/v2/suspensions` · `/v2/corporate-actions`

Hemat kredit: endpoint per-saham menerima jendela 90 hari di masa lalu seharga 1 kredit, jadi histori ±15 bulan cukup 5 panggilan per saham; screener dengan `include_query_values` memberi 200 emiten × 12 data fundamental dalam 2 panggilan; setiap respons di-cache permanen. Total kredit terpakai ≈ 1.400. Kuota inilah yang membatasi panjang histori.

## Menjalankan

```bash
# 1. Pipeline data (Python 3.11+)
pip install -r requirements.txt
cp .env.example .env            # isi SECTORS_API_KEY
python -m arus.ingest --dry-run # estimasi kredit
python -m arus.ingest           # tarik data (ter-cache, bisa dilanjutkan)
python -m arus.build --brokers 30

# 2. Situs
cd web && npm install && npm run dev      # http://localhost:3000
npm run build                              # ekspor statis ke web/out

# 3. Agen & Telegram (opsional)
python -m arus.agent setup-bot   # beri bot nama, deskripsi, menu perintah
python -m arus.agent daily       # refresh + belajar ulang + rapor + kirim ringkasan
python -m arus.agent bot         # bot menjawab perintah & pertanyaan
```

Situs membaca `web/src/data/`, jadi bisa dibuka **tanpa API key**. Pipeline tetap 100% bersumber dari Sectors.

## Bot Telegram

`/hari_ini` · `/saham BBRI` · `/unggul` · `/waspada` · `/pantau KODE` · `/pantauan` · `/syariah on` · `/harga 1000` · `/rapor` · `/bahasa en` · atau tanya bebas (“BBRI masih layak dipantau?”). Bot membaca snapshot, jadi bertanya tidak menghabiskan kredit API. Tanya bebas opsional: isi `ARUS_ASK_CMD` di `.env` dengan perintah CLI model bahasa yang menerima pertanyaan lewat stdin.

## Keterbatasan

- Data harian (final setelah bursa tutup), bukan detik-ke-detik.
- Hanya ±15 bulan data (Juli 2025 – Oktober 2026), dibatasi kuota kredit; itu baru satu-dua kondisi pasar. Model dilatih ulang setiap hari.
- Universe = saham aktif hari ini (bias survivorship kecil).
- Angka hit rate belum termasuk biaya; kurva backtest menampilkan versi setelah biaya ±0,4% per putaran. Slippage tidak dihitung.
- Jejak bandar & fundamental hanya snapshot, karena itu tidak diskor.

## Disclaimer

Arus adalah alat informasi dan analisis, **bukan nasihat keuangan** dan bukan ajakan membeli atau menjual efek. Tidak ada eksekusi order otomatis. Skor adalah frekuensi historis, bukan jaminan hasil. Keputusan dan risikonya sepenuhnya milik pengguna.

---

### English summary

Arus gives every one of the 120 most active IDX stocks a daily **score out of 100** — of 100 past situations that looked like this stock today, how many ended better than half of all other stocks — for the next trading day. A 1-month model is retrained daily too but only published when it passes validation; it currently doesn't, and its results are disclosed under Model governance. The model learns from ~15 months of Sectors data, is validated with purged walk-forward testing, calibrated so its numbers mean what they say, explains every score in plain language, shows the evidence that disagrees, and runs as a daily agent that grades itself and reports to Telegram. Information, not financial advice.

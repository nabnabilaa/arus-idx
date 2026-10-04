# 🌊 Arus — skor peluang saham IDX yang jujur

> **Untuk investor ritel IDX yang kebanjiran data tapi kekurangan keyakinan, Arus memberi setiap saham satu skor peluang yang sudah diuji ke data setahun, menjelaskan alasannya dalam bahasa biasa, dan berani bilang “tidak yakin” saat buktinya tipis.**

Sectors Hackathon 2026 · Track 03 — Market Intelligence · Data: [Sectors API](https://sectors.app)

---

## Apa yang dilakukan Arus

Setiap hari bursa Arus menilai 120 saham paling aktif di BEI dan menjawab satu pertanyaan:

**“Dari 100 kondisi di masa lalu yang mirip saham ini hari ini, berapa yang berakhir lebih baik daripada separuh saham lain?”**

- **Skor X/100** dengan 50 = lempar koin, untuk dua jangka waktu: **Besok** (trader harian) dan **1 bulan** (swing/investor).
- **Lima tingkat yang mudah dibaca:** Sangat diunggulkan · Diunggulkan · Netral · Kurang diunggulkan · Waspada.
- **Alasan dalam bahasa biasa** untuk setiap skor (mis. “Pergerakan tenang — di data setahun terakhir, saham yang tenang lebih sering unggul”).
- **Level penting harian:** gerak normal harian, batas bawah/atas 1 bulan, batas sinyal batal.
- **Bukti tambahan yang sengaja tidak dicampur ke skor:** jejak bandar (broker institusi vs ritel), fundamental vs rekan sektor, transaksi orang dalam, kejadian tak biasa.
- **Agen harian + bot Telegram** yang mengambil data baru, belajar ulang, **menilai dirinya sendiri**, lalu mengirim ringkasan.

## Kenapa berbeda

Banyak laporan saham menulis “Confidence 78%” tanpa pernah menguji dari mana angka itu. Arus melakukan sebaliknya:

| | Skor biasa | Arus |
|---|---|---|
| Asal angka | Bobot buatan manusia | Dipelajari dari data setahun |
| Diuji? | Jarang | Walk-forward seperti dipakai sungguhan, dengan jeda anti-bocor |
| Arti “56” | Tidak jelas | 56 dari 100 kejadian serupa memang unggul (dikalibrasi) |
| Saat bukti lemah | Tetap terdengar yakin | Skor dekat 50, label “Netral” |
| Periode gagal | Disembunyikan | Ditampilkan di halaman Bukti |

## Hasil uji (jujur, out-of-sample)

| Jangka waktu | Periode di atas acak | “Sangat diunggulkan” unggul | “Waspada” unggul |
|---|---|---|---|
| Besok | **6 dari 7** | 53 dari 100 | 47 dari 100 |
| 1 bulan | 4 dari 5 | 53 dari 100 | 43 dari 100 |

Sinyalnya nyata tapi sederhana, seperti hampir semua sinyal pasar yang jujur. Arus paling bisa diandalkan sebagai **saringan pertama**: 57 dari 100 saham bertanda Waspada memang berakhir di separuh bawah dalam sebulan. Detail lengkap (AUC, kalibrasi, stabilitas per periode) ada di halaman **Bukti**.

Temuan menarik: di pasar 2026 yang sedang turun, **mengejar momentum dan dana asing justru sedikit di bawah lempar koin**, sedangkan saham yang tenang dan tidak terlalu ramai lebih sering unggul. Arus belajar dari data, bukan dari kebiasaan.

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

Hemat kredit: endpoint per-saham menerima jendela 90 hari di masa lalu seharga 1 kredit, jadi histori setahun cukup 4 panggilan per saham; screener dengan `include_query_values` memberi 200 emiten × 12 data fundamental dalam 2 panggilan; setiap respons di-cache permanen. Total pembangunan awal ≈ 1.130 kredit.

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
- Satu tahun data, sebagian besar di pasar yang sedang turun; model dilatih ulang setiap hari.
- Universe = saham aktif hari ini (bias survivorship kecil).
- Tanpa biaya transaksi dan slippage.
- Jejak bandar & fundamental hanya snapshot, karena itu tidak diskor.

## Disclaimer

Arus adalah alat informasi dan analisis, **bukan nasihat keuangan** dan bukan ajakan membeli atau menjual efek. Tidak ada eksekusi order otomatis. Skor adalah frekuensi historis, bukan jaminan hasil. Keputusan dan risikonya sepenuhnya milik pengguna.

---

### English summary

Arus gives every one of the 120 most active IDX stocks a daily **score out of 100** — of 100 past situations that looked like this stock today, how many ended better than half of all other stocks — for two horizons (next day, 1 month). The model learns from a year of Sectors data, is validated with purged walk-forward testing, calibrated so its numbers mean what they say, explains every score in plain language, shows the evidence that disagrees, and runs as a daily agent that grades itself and reports to Telegram. Information, not financial advice.

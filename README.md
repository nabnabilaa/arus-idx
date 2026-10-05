# 🌊 Arus — intelijen pasar saham IDX yang jujur

> **Untuk investor ritel IDX yang kebanjiran data tapi kekurangan keyakinan, Arus menunjukkan apa yang sebenarnya terjadi di balik sebuah saham — siapa yang membeli, seberapa sehat perusahaannya, seberapa jauh harganya wajar bergerak — dan hanya mempublikasikan prediksi yang lolos uji.**

Sectors Hackathon 2026 · Track 03 — Market Intelligence · Data inti: [Sectors API](https://sectors.app)

---

## Apa yang dilakukan Arus

Arus memantau **309 saham IDX** (semua saham dengan transaksi median ≥ Rp1 miliar/hari) dan menjawab satu saham dari tiga sudut pandang:

| Sudut pandang | Pertanyaan | Alat Arus | Diuji? |
|---|---|---|---|
| **Trader harian** | Bagaimana peluangnya besok? | Peringkat peluang hari bursa berikutnya, dengan alasan dalam bahasa biasa | ✅ walk-forward, 9 dari 10 periode di atas acak |
| **Swing (1–4 minggu)** | Seberapa jauh harga wajar bergerak? | Rentang wajar 1 minggu & 1 bulan dari perilaku saham itu sendiri | ✅ memuat 81% hasil sebenarnya (target 80%) |
| **Investor** | Seberapa sehat perusahaannya? | 9 pemeriksaan F-Score Piotroski + laporan keuangan 5 tahun dalam rupiah (±300 perusahaan) | deskriptif |

Ditambah:

- **Bandar.** Ringkasan broker ala aplikasi sekuritas (1/5/semua hari: pembeli & penjual, lot, harga rata-rata) **plus yang tidak ada di tempat lain: gaya beli tiap broker** (ikut saat ramai, menampung saat turun, beli rutin, jual saat naik), apa yang terjadi 3 hari setelah ia membeli, deteksi pola mirip "pompom", direktori 88 broker dengan halaman masing-masing.
- **Kejadian tak biasa.** Setiap saham dibandingkan dengan kebiasaannya sendiri (asing borong/jual besar, volume melonjak, harga bergerak tajam), dalam rupiah dan kelipatan, plus **apa yang biasanya terjadi sesudahnya** di histori Arus.
- **Orang dalam.** 854 laporan kepemilikan KSEI (90 hari) dibaca utuh: siapa yang terus menambah atau melepas ("rantai" transaksi dengan grafik harga dan titik hari transaksi), harga rata-rata, kepemilikan sebelum/sesudah, harga sekarang vs rata-rata, tautan ke PDF KSEI, dan **apa yang terjadi pada harga sesudahnya**. Repo (gadai), private placement, opsi karyawan, pengalihan blok, perantara dua arah, dan laporan berharga tidak wajar (kesalahan data sumber) dipisahkan dari transaksi pasar. Temuan yang ditampilkan apa adanya: dalam 90 hari ini pembelian orang dalam belum menjadi tanda saham akan unggul.
- **Agenda.** Kalender ex-dividen (yield dari harga terakhir, tanggal terakhir beli), RUPS, rights issue (pengenceran dan diskon), stock split, waran — plus studi 62 ex-dividen: harga rata-rata turun ±80% dari dividennya, ±70% pulih ke harga cum dalam 20 hari bursa.
- **Rekap pekan.** IHSG, naik vs turun, 45 saham paling likuid, top movers likuid, arus asing per hari, sektor, volume tak biasa, orang dalam, agenda pekan depan, dan bacaan "yang mendukung / yang perlu diwaspadai" yang disusun dari angka itu sendiri. Terkirim ke Telegram tiap Jumat.
- **Penanda risiko** dari fakta bursa, bukan model: papan pemantauan khusus, cooling down/suspensi, orang dalam menjual, rights issue yang mengencerkan, pola mirip pompom, papan akselerasi.
- **Murah atau memang segitu?** PBV dibaca bersama ROE: dibanding PBV sesama subsektor untuk ROE yang sama dan PBV wajar ROE ÷ 12%, dengan grafik sebar dan ROE 5 tahun.
- **Kartu siap bagi.** 71 kartu PNG 1080×1350 (kejadian tak biasa, rantai orang dalam, rekap pekan) dibuat saat build, tinggal unduh untuk media sosial.
- **Rencana trade.** Perencana CL/TP per saham: harga dibulatkan ke fraksi BEI, lot & risiko rupiah, lalu seberapa sering TP vs CL tersentuh duluan di saham itu, dibanding angka impas rasio untung:rugi — termasuk kondisi "setelah naik kencang (euforia)".
- **Pengaruh global.** Sensitivitas tiap saham terhadap rupiah, minyak, S&P 500, VIX, dolar, dan bunga AS (FRED & ECB), serta keterkaitannya dengan IHSG.
- **Berita** dari Sectors, sektor yang bisa dijelajah, pantauan, perbandingan 2–4 saham, pencarian Ctrl+K, ID/EN.
- **Agen harian + bot Telegram** (@nab_arus_bot) yang mengambil data baru, belajar ulang, menilai dirinya sendiri, dan mengirim ringkasan + **peringatan untuk saham pantauan**.

## Kenapa berbeda: rapor yang jujur

Banyak laporan saham menulis “Confidence 78%” tanpa pernah menguji angkanya. Arus menguji semuanya seperti dipakai sungguhan (model hanya belajar dari masa lalu, dinilai pada bulan-bulan sesudahnya) dan memuat rapornya di halaman **Bukti**:

| Model | Uji out-of-sample | Hasil | Status |
|---|---|---|---|
| Skor besok | 10 periode, Des 2025 – Okt 2026 | AUC 0,540 · di atas acak 9/10 periode · kelompok teratas unggul 54/100 vs terbawah 44/100 | **dipublikasikan** |
| Rentang wajar | seluruh histori | 1 minggu 81% · 1 bulan 81% (target 80%) | **dipublikasikan** |
| Skor 1 bulan | 8 periode, Jan – Sep 2026 | di atas acak hanya 4/8 periode | **tidak dipublikasikan** |

Skor 1 bulan sempat tampak +11% di atas IHSG pada histori pendek; setelah histori diperpanjang, keunggulannya hilang — jadi model itu ditarik otomatis, dan alasannya dibuka. Skor besok juga **rugi setelah biaya kalau dipakai beli-jual setiap hari**, dan itu ditampilkan: gunanya sebagai saringan, bukan strategi.

## Data

**Sectors (inti)** — semua yang membuat Arus lebih dari sekadar grafik harga:

`/v2/daily/{symbol}` · `/v2/foreign-flow/{symbol}` · `/v2/index-daily/ihsg` · `/v2/companies` (screener: fundamental 200 emiten + **laporan keuangan 5 tahun lewat `field[year]` + `include_query_values`**, JII70) · `/v2/broker-summary/{symbol}` (broker harian 120 saham) · `/v2/brokers` · `/v2/news` · `/v2/filings` (854 laporan orang dalam lengkap) · `/v2/suspensions` · `/v2/corporate-actions` (kalender dividen, RUPS, rights, split, waran) · `/v2/mining/commodities/{name}/price`

Hemat kredit: jendela 90 hari per panggilan, screener multi-tahun (laporan keuangan 120 perusahaan × 5 tahun × 13 pos = 4 kredit), cache permanen. Total ±1.580 kredit untuk seluruh proyek.

**Pelengkap gratis:** ringkasan perdagangan resmi BEI (harga, volume, dana asing semua saham — memperluas cakupan dari 120 ke 309 saham dan menjadi pembaruan harian tanpa kredit; dicocokkan dengan Sectors: OHLCV identik), FRED (S&P 500, VIX, Brent, dolar, bunga AS), kurs referensi ECB (USD/IDR).

## Arsitektur

```
Sectors API ──► client.py (cache permanen + meteran kredit)      BEI ──► idx.py / universe.py (gratis)
                    │                                                     │
                    ▼                                                     ▼
               ingest.py ───────────────────► SQLite (data/*.db, tidak di-commit) ◄── macro.py (FRED, ECB)
                                                    │
        features.py (sinyal kausal, persentil harian) · financial.py (F-Score) · context.py (broker, anomali, berita)
                                                    │
        model.py (regresi logistik L2 · walk-forward ber-jeda · kalibrasi Platt monoton · flag `proven`)
                                                    │
        build.py ──► snapshot/ + web/src/data/  (hasil turunan saja, tanpa API key)
                                                    │
        agent.py (harian 17.45: BEI → latih ulang → rapor → Telegram + peringatan pantauan)   web/ (Next.js statis, ID/EN)
```

## Menjalankan

```bash
# 1. Pipeline data (Python 3.11+)
pip install -r requirements-pipeline.txt
cp .env.example .env              # isi SECTORS_API_KEY (dan TELEGRAM_BOT_TOKEN untuk bot)
python -m arus.ingest --dry-run   # estimasi kredit
python -m arus.ingest             # histori, fundamental, konteks (ter-cache, bisa dilanjutkan)
python -m arus.ingest --step financials
python -m arus.universe all       # profil & histori BEI semua saham, perluas universe (gratis)
python -m arus.build              # fitur, model, validasi, snapshot

# 2. Situs
cd web && npm install && npm run dev   # pengembangan
npm run build                          # ekspor statis ke web/out

# 3. Agen & Telegram (opsional)
python -m arus.agent setup-bot   # nama, deskripsi, menu perintah bot
python -m arus.agent daily       # BEI → latih ulang → rapor → ringkasan + peringatan pantauan
python -m arus.agent bot         # bot menjawab perintah & pertanyaan
```

Situs membaca `web/src/data/`, jadi bisa dibuka **tanpa API key**.

## Deploy (semua di Vercel)

| Proyek Vercel | Root directory | Isi |
|---|---|---|
| Situs | `web` | Next.js ekspor statis, tanpa pengaturan tambahan |
| Bot | `.` (akar repo) | Fungsi `api/telegram.py` (webhook Telegram), penyimpanan pantauan di Upstash Redis |

Bot: tambahkan integrasi **Upstash for Redis** di Vercel (mengisi `KV_REST_API_URL`/`KV_REST_API_TOKEN`), isi `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_WEBHOOK_SECRET`, lalu arahkan Telegram ke webhook:

```bash
python -m arus.agent set-webhook --url https://<proyek-bot>.vercel.app/api/telegram
```

Agen harian (`scripts/daily.ps1`) memperbarui data, lalu commit & push; Vercel membangun ulang situs dan bot otomatis.

## Bot Telegram

`/hari_ini` · `/saham BBRI` · `/unggul` · `/waspada` · `/pantau KODE` · `/pantauan` · `/syariah on` · `/harga 1000` · `/rapor` · `/bahasa en` · atau tanya bebas. Saham pantauan otomatis mendapat peringatan saat asing borong/jual besar, volume melonjak, harga menembus batas, atau arah broker berbalik.

## Keterbatasan

- Data harian (final setelah bursa tutup), bukan detik-ke-detik.
- Histori ±15 bulan (Juli 2025 – Oktober 2026): satu-dua kondisi pasar saja. Model dilatih ulang setiap hari.
- Keunggulan skor besok ada di semua ukuran saham, tapi di semua ukuran tetap kalah oleh biaya kalau dipakai beli-jual harian.
- Data broker harian 2–4 minggu dan hanya untuk 120 saham utama; berita beberapa hari terakhir.
- Universe = saham aktif hari ini (bias survivorship kecil).

## Disclaimer

Arus adalah alat informasi dan analisis, **bukan nasihat keuangan** dan bukan ajakan membeli atau menjual efek. Tidak ada eksekusi order otomatis. Angka historis bukan jaminan hasil. Keputusan dan risikonya sepenuhnya milik pengguna.

---

### English summary

Arus covers 309 IDX stocks (every stock trading at least IDR 1B a day) and reads each one from three angles: a next-day odds rank for day traders (walk-forward AUC 0.540, beat chance in 9 of 10 periods), a tested typical price range for swing traders (holds 81% of outcomes vs an 80% target), and Piotroski-style financial health from five years of statements for investors. On top: insider filing chains with what followed (repo pledges, block transfers and corrupt source prices filtered out), a dividend/AGM/rights calendar with an ex-dividend study, a weekly recap, fact-based risk flags, P/B read against ROE, shareable PNG cards, a broker-summary view plus each broker's buying style and what followed, unusual-activity flags with historical follow-through, a per-stock stop/target planner, global-factor sensitivity, news, a watchlist with Telegram alerts, comparison and search. Sectors API is the core source; the official IDX trading summary widens coverage and powers free daily updates. A 1-month model that failed validation is withheld and disclosed. Information, not financial advice.

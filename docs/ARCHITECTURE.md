# Arsitektur Arus

Dokumen ini menjelaskan bagaimana data mengalir dari Sectors sampai ke layar, dan kenapa tiap keputusan diambil.

## Alur data

```
                ┌────────────── Sectors API (inti) ──────────────┐
                │ harga & asing 120 saham · fundamental · laporan │
                │ keuangan 5 thn · broker harian · berita · filing│
                └───────────────────────┬─────────────────────────┘
                                        ▼
  BEI (ringkasan harian, gratis) ──► client.py ── cache permanen + meteran kredit + batas keras per penarikan
  FRED · ECB (makro, gratis)            │
                                        ▼
                          SQLite: data/warehouse.db  (tidak di-commit)
                                        │
          ┌──────────────┬──────────────┼───────────────┬──────────────────┐
          ▼              ▼              ▼               ▼                  ▼
     features.py    financial.py    context.py      macro.py          model.py
     sinyal kausal  F-Score         broker, anomali, sensitivitas     walk-forward,
     (persentil     Piotroski       berita, gaya     faktor global     kalibrasi,
      harian)                       broker                             flag `proven`
          └──────────────┴──────────────┬───────────────┴──────────────────┘
                                        ▼
                     build.py ──► snapshot/*.json + web/src/data/*.json
                                        │                     │
                                        ▼                     ▼
                     agent.py (harian 17.45)        web/ (Next.js, ekspor statis)
                     BEI → latih ulang → rapor      410 halaman, tanpa API key
                     → Telegram + peringatan        di sisi klien
```

## Modul

| Modul | Tanggung jawab |
|---|---|
| `arus/client.py` | Satu-satunya pintu ke Sectors: cache permanen per permintaan, ledger kredit, batas kredit per pemanggilan (melempar error sebelum melewati batas). |
| `arus/ingest.py` | Penarikan Sectors: universe & fundamental lewat screener, histori 90 hari per panggilan, laporan keuangan multi-tahun, broker harian, berita. |
| `arus/idx.py`, `arus/universe.py` | Ringkasan perdagangan resmi BEI: pembaruan harian gratis dan perluasan dari 120 ke 309 saham. Tidak pernah menimpa baris dari Sectors. |
| `arus/features.py` | Sinyal yang hanya memakai data sampai hari itu (tanpa bocoran masa depan), diubah menjadi persentil harian antar-saham. |
| `arus/model.py` | Regresi logistik L2 dengan bentuk global/per-sektor, validasi walk-forward ber-jeda, kalibrasi Platt monoton, metrik out-of-sample, flag `proven`. |
| `arus/financial.py` | Sembilan pemeriksaan F-Score dengan angka bukti sebelum/sesudah; pemeriksaan yang tak berlaku untuk bank dilewati. |
| `arus/context.py` | Ringkasan broker 1/5/semua hari, gaya beli tiap broker dan hasil 3 hari sesudahnya, pola mirip pompom, kejadian tak biasa dan statistik sesudahnya, berita. |
| `arus/build.py` | Menjalankan semuanya dan menulis snapshot turunan (tanpa data mentah, tanpa kunci). |
| `arus/agent.py` | Agen harian, penilaian diri (rekam jejak live), digest & peringatan pantauan Telegram, bot perintah. |
| `web/` | Next.js App Router, ekspor statis. Halaman server memilih potongan data; komponen klien tidak pernah mengimpor bundel data penuh. |

## Keputusan desain

**Target "unggul dari separuh saham lain", bukan "naik".** Peluang saham acak naik atau mengalahkan IHSG berayun antar bulan karena segelintir saham raksasa. Target relatif selalu 50% untuk pilihan acak, jadi angka di atas 50 benar-benar berarti keunggulan.

**Walk-forward ber-jeda.** Setiap blok 20 hari diuji dengan model yang hanya dilatih pada data yang labelnya sudah selesai sebelum blok dimulai. Tidak ada informasi masa depan yang bocor.

**Model yang gagal tidak dipublikasikan.** Sebuah horizon hanya tampil kalau AUC > 0,5, lebih dari separuh periode di atas acak, dan kelompok teratas mengalahkan kelompok terbawah. Skor 1 bulan gagal setelah histori diperpanjang, jadi situs dan bot otomatis menyembunyikannya dan halaman Bukti membuka alasannya. Kalibrasi Platt dibuat monoton supaya peluang tidak pernah terbalik terhadap peringkat.

**Kejujuran soal biaya.** Uji yang sama dipisah per ukuran perusahaan dan dikurangi biaya ±0,4% per putaran. Keunggulan ada di semua ukuran, tapi beli-jual harian tetap kalah oleh biaya. Karena itu skor besok diposisikan sebagai saringan.

**Rentang wajar dikalibrasi ke data.** Rentang mentah dari sebaran gerak saham hanya memuat 64–73% hasil; satu faktor pelebar per horizon dikalibrasi supaya memuat 80%, dan angka sebelum/sesudah ditampilkan.

**Hemat kredit.** Jendela 90 hari per panggilan; screener `field[year]` + `include_query_values` mengambil laporan keuangan ratusan perusahaan dalam beberapa panggilan; cache permanen; batas kredit keras di setiap penarikan. Data yang tersedia gratis dan resmi (BEI) dipakai untuk memperluas cakupan, sehingga kredit Sectors dipakai untuk data yang hanya ada di Sectors (broker harian, laporan keuangan, berita).

**Statis dan aman.** Situs adalah ekspor statis: tidak ada server, tidak ada API key di browser. Pembaruan terjadi lewat build ulang dari agen harian.

## Uji

`python -m unittest discover tests` memeriksa F-Score, kalibrasi monoton, AUC, dan aturan peringatan pantauan. CI (`.github/workflows/ci.yml`) menjalankan tes Python, lint, typecheck, dan build statis di setiap push.

import type { Bi } from "./i18n";

export type Term = { title: Bi; body: Bi };

export const GLOSSARY: Record<string, Term> = {
  score: {
    title: { id: "Skor Arus (X dari 100)", en: "Arus score (X out of 100)" },
    body: {
      id: "Arus mencari semua kejadian di masa lalu yang kondisinya mirip saham ini hari ini. Skor 56 artinya: dari 100 kejadian mirip itu, 56 bergerak lebih baik daripada separuh saham lainnya. Angka 50 berarti sama saja dengan memilih saham secara acak.",
      en: "Arus finds every past situation that looked like this stock today. A score of 56 means: of 100 such situations, 56 ended better than half of all other stocks. 50 means no better than picking at random.",
    },
  },
  coin: {
    title: { id: "Kenapa 50 = memilih acak?", en: "Why does 50 mean random?" },
    body: {
      id: "Kami membandingkan setiap saham dengan saham lain. Kalau dipilih acak, peluang sebuah saham masuk separuh teratas pasti 50 dari 100. Jadi skor di atas 50 berarti ada keunggulan, di bawah 50 berarti lebih sering kalah.",
      en: "We compare each stock with the others. Picked at random, a stock lands in the top half exactly 50 times out of 100. Above 50 means an edge; below 50 means it lags more often.",
    },
  },
  scale: {
    title: { id: "Kenapa skornya cuma 40–60?", en: "Why only 40–60?" },
    body: {
      id: "Karena pasar saham memang sulit ditebak, dan Arus tidak mau melebih-lebihkan. Selisih beberapa poin dari 50, kalau konsisten, sudah sangat berarti. Siapa pun yang menjanjikan 80–90% hampir pasti mengarang.",
      en: "Because markets are genuinely hard to predict, and Arus refuses to exaggerate. A few points above 50, held consistently, is already meaningful. Anyone promising 80–90% is almost certainly making it up.",
    },
  },
  horizon: {
    title: { id: "Besok atau 1 bulan?", en: "Next day or 1 month?" },
    body: {
      id: "Arus menghitung dua skor terpisah. 'Besok' untuk trader harian: peluang di hari bursa berikutnya. '1 bulan' untuk swing atau investor: peluang dalam 20 hari bursa. Keduanya diuji sendiri-sendiri dan bisa berbeda.",
      en: "Arus computes two separate scores. 'Next day' is for day traders: the odds over the next session. '1 month' is for swing traders and investors: the odds over 20 sessions. Each is tested on its own and they can disagree.",
    },
  },
  verdict: {
    title: { id: "Lima tingkat penilaian", en: "Five levels" },
    body: {
      id: "Setiap hari semua saham diurutkan. 10% teratas = Sangat diunggulkan, berikutnya Diunggulkan, tengah = Netral, lalu Kurang diunggulkan, dan 10% terbawah = Waspada. Untuk skor Besok, uji historis menunjukkan Arus paling akurat justru saat memberi tanda Waspada.",
      en: "Every day all stocks are ranked. The top 10% = Strong edge, then Edge, the middle = Neutral, then Weak, and the bottom 10% = Caution. For the next-day score, historical testing shows Arus is most accurate when it flags Caution.",
    },
  },
  evidence: {
    title: { id: "Dari berapa kejadian?", en: "How many cases?" },
    body: {
      id: "Jumlah kejadian serupa di masa lalu yang dipakai untuk menghitung skor. Kami menghitungnya secara hati-hati: hari-hari yang berdekatan dianggap satu kejadian, supaya tidak terlihat lebih yakin dari seharusnya.",
      en: "How many similar past cases the score is built on. We count conservatively: neighbouring days count as one case, so we never look surer than we are.",
    },
  },
  range: {
    title: { id: "Rentang kemungkinan", en: "Likely range" },
    body: {
      id: "Skor bisa sedikit meleset karena jumlah kejadian serupa terbatas. Rentang ini menunjukkan di mana skor sebenarnya kemungkinan besar berada. Rentang lebar = buktinya masih tipis.",
      en: "The score can be a little off because similar cases are limited. This range shows where the true score most likely sits. A wide range means thin evidence.",
    },
  },
  normalRange: {
    title: { id: "Gerak normal harian", en: "Normal daily move" },
    body: {
      id: "Rata-rata seberapa jauh harga saham ini naik-turun dalam sehari selama 14 hari terakhir. Gerak di dalam rentang ini adalah hal biasa, bukan sinyal.",
      en: "How far this stock typically moves in a day over the last 14 sessions. Moves inside this range are normal noise, not a signal.",
    },
  },
  supportResistance: {
    title: { id: "Batas bawah & atas 1 bulan", en: "1-month floor & ceiling" },
    body: {
      id: "Harga terendah dan tertinggi dalam 20 hari bursa terakhir. Banyak trader memperhatikan level ini karena harga sering tertahan di sana.",
      en: "The lowest and highest prices over the last 20 sessions. Many traders watch these levels because price often stalls there.",
    },
  },
  invalidate: {
    title: { id: "Batas sinyal batal", en: "Signal invalidation" },
    body: {
      id: "Harga sekarang dikurangi dua kali gerak normal harian. Kalau harga jatuh di bawah level ini, kondisinya sudah berubah jauh dari saat skor dihitung, jadi skor lama tidak berlaku lagi. Ini informasi, bukan perintah jual.",
      en: "Today's price minus twice the normal daily move. If price falls below it, conditions have changed too much for the old score to hold. Information, not a sell order.",
    },
  },
  foreignFlow: {
    title: { id: "Dana asing", en: "Foreign flow" },
    body: {
      id: "Selisih uang yang dipakai investor asing untuk membeli dan menjual. Positif = asing lebih banyak membeli. Investor asing umumnya institusi besar dengan riset mendalam, jadi arahnya sering diperhatikan.",
      en: "Money foreign investors spent buying minus selling. Positive means foreigners bought more. They are mostly large research-driven institutions, so their direction is widely watched.",
    },
  },
  broker: {
    title: { id: "Jejak bandar (broker)", en: "Broker footprint" },
    body: {
      id: "Siapa yang paling banyak membeli dan menjual: broker yang melayani institusi atau ritel, asing atau lokal. Pola yang patut diwaspadai: institusi diam-diam menjual sementara ritel membeli. Ini ditampilkan sebagai konteks dan tidak memengaruhi skor.",
      en: "Who bought and sold the most: brokers serving institutions or retail, foreign or local. The pattern to watch: institutions quietly selling while retail buys. Shown as context; it does not change the score.",
    },
  },
  anomaly: {
    title: { id: "Seberapa tidak biasa", en: "How unusual" },
    body: {
      id: "Kami membandingkan hari ini dengan 60 hari terakhir saham itu sendiri. Angka 3× atau lebih berarti kejadian langka untuk saham tersebut, misalnya volume atau beli asing yang jauh di atas kebiasaannya.",
      en: "We compare today with the stock's own last 60 days. 3× or more means a rare event for that stock, such as volume or foreign buying far above its habit.",
    },
  },
  liquidity: {
    title: { id: "Nilai transaksi harian", en: "Daily traded value" },
    body: {
      id: "Rata-rata uang yang berpindah tangan per hari di saham ini. Ini batas bawah, bukan batas atas: saham besar seperti BBCA bertransaksi triliunan per hari dan tetap tampil. Naikkan batas ini kalau Anda bertransaksi besar dan butuh mudah keluar-masuk.",
      en: "The average money changing hands per day in this stock. It is a minimum, not a cap: large caps like BBCA trade trillions a day and still show. Raise it if you trade size and need easy exits.",
    },
  },
  sharia: {
    title: { id: "Saham syariah", en: "Sharia stocks" },
    body: {
      id: "Ditandai dari keanggotaan indeks JII70 (70 saham syariah paling likuid di BEI) dalam data Sectors. Saham di luar tanda ini masih mungkin syariah karena daftar lengkapnya (DES/ISSI) lebih besar. Selalu cek daftar resmi OJK.",
      en: "Flagged from JII70 index membership (the 70 most liquid sharia stocks on the IDX) in Sectors data. Unflagged stocks may still be sharia-compliant, since the full list (DES/ISSI) is larger. Always check OJK's official list.",
    },
  },
  auc: {
    title: { id: "AUC", en: "AUC" },
    body: {
      id: "Ukuran teknis kemampuan membedakan saham yang menang dan kalah. 0,50 = sama dengan menebak acak, 1,00 = sempurna. Di pasar saham, 0,52–0,56 yang konsisten sudah bermakna; angka di atas 0,60 patut dicurigai.",
      en: "A technical measure of telling winners from losers. 0.50 = random guessing, 1.00 = perfect. In equities a consistent 0.52–0.56 is meaningful; above 0.60 deserves suspicion.",
    },
  },
  brier: {
    title: { id: "Brier skill", en: "Brier skill" },
    body: {
      id: "Apakah angka peluang Arus lebih akurat daripada selalu menebak 50. Positif = lebih akurat; nol = tidak menambah informasi.",
      en: "Whether Arus' probabilities are more accurate than always guessing 50. Positive = more accurate; zero = adds no information.",
    },
  },
  walkForward: {
    title: { id: "Diuji seperti waktu nyata", en: "Tested like real time" },
    body: {
      id: "Model hanya boleh belajar dari masa lalu, lalu diuji pada periode sesudahnya yang belum pernah ia lihat, maju terus seperti dipakai sungguhan. Ada jeda di antara keduanya supaya jawaban masa depan tidak bocor.",
      en: "The model may only learn from the past, then is tested on a later period it has never seen, rolling forward as if used for real. A gap between the two keeps future answers from leaking.",
    },
  },
};

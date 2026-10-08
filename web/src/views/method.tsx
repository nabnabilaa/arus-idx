"use client";

import { motion } from "motion/react";
import { Term } from "@/components/term";
import { T, useLang, type Bi } from "@/lib/i18n";
import type { Bundle } from "@/lib/types";

const EASE = [0.23, 1, 0.32, 1] as const;

const STEPS: { title: Bi; body: Bi }[] = [
  { title: { id: "Data dari Sectors", en: "Data from Sectors" }, body: { id: "Harga, volume, dana asing, broker, fundamental, orang dalam", en: "Prices, volume, foreign flow, brokers, fundamentals, insiders" } },
  { title: { id: "14 kondisi per saham", en: "14 conditions per stock" }, body: { id: "Dikelompokkan jadi 5: dana asing, arah harga, jejak pembelian, sektor, risiko", en: "Grouped into 5: foreign money, price direction, buying footprint, sector, risk" } },
  { title: { id: "Belajar dari ±15 bulan data", en: "Learn from ~15 months" }, body: { id: "Model mencari kombinasi kondisi yang benar-benar menang", en: "The model finds which combinations actually won" } },
  { title: { id: "Diuji seperti nyata", en: "Tested like real life" }, body: { id: "Hanya boleh belajar dari masa lalu, dinilai pada masa sesudahnya", en: "Learns only from the past, graded on what came after" } },
  { title: { id: "Diubah jadi “X dari 100”", en: "Turned into “X out of 100”" }, body: { id: "Skor mentah dipetakan ke frekuensi yang benar-benar terjadi", en: "Raw scores mapped to frequencies that actually happened" } },
  { title: { id: "Web + Telegram", en: "Web + Telegram" }, body: { id: "Skor, alasan, level penting, dan risiko setiap hari", en: "Score, reasons, key levels and risks every day" } },
];

const DECISIONS: { chose: Bi; why: Bi; rejected: Bi; term?: string }[] = [
  {
    chose: { id: "Skor diukur terhadap saham lain, bukan terhadap IHSG.", en: "Scores measure against other stocks, not against IHSG." },
    why: {
      id: "Kami awalnya memakai target “mengalahkan IHSG”. Ternyata peluang saham acak mengalahkan IHSG berayun 44%–58% antar bulan, tergantung nasib segelintir saham raksasa. Dengan membandingkan ke saham lain, pilihan acak selalu bernilai 50, jadi skor 56 punya arti yang tetap setiap hari.",
      en: "We first used “beat IHSG”. A random stock's odds of doing so swung 44%–58% month to month, driven by a few giants. Comparing against other stocks makes a random pick always worth 50, so a 56 means the same thing every day.",
    },
    rejected: { id: "Target IHSG (angkanya menyesatkan) dan target “naik/turun” (di pasar naik semua saham naik).", en: "An IHSG target (misleading numbers) and an up/down target (in a rising market everything rises)." },
    term: "coin",
  },
  {
    chose: { id: "Tiga sudut pandang, masing-masing dengan alat yang lolos ujinya sendiri.", en: "Three viewpoints, each with a tool that passes its own test." },
    why: {
      id: "Trader harian, swing, dan investor butuh jawaban berbeda. Untuk besok: skor peluang (lebih baik dari acak di 7 dari 10 periode). Untuk beberapa minggu: rentang harga wajar yang terbukti memuat 8 dari 10 hasil. Untuk jangka panjang: kesehatan keuangan dari laporan tahunan. Skor peluang 1 bulan juga dicoba, tapi tidak lolos uji, jadi tidak dipublikasikan.",
      en: "Day traders, swing traders and investors need different answers. Next day: an odds score (beat random in 7 of 10 periods). A few weeks: a typical price range proven to hold 8 in 10 outcomes. Long term: financial health from annual reports. A 1-month odds score was tried too, but failed testing, so it isn't published.",
    },
    rejected: { id: "Satu skor untuk semua gaya trading, atau skor yang tidak lolos uji.", en: "One score for every style, or a score that failed testing." },
    term: "horizon",
  },
  {
    chose: { id: "Setiap kondisi dinilai relatif terhadap saham lain di hari yang sama.", en: "Every condition is ranked against other stocks on the same day." },
    why: {
      id: "Yang penting bukan “asing beli Rp10 miliar”, tapi “asing membeli saham ini lebih agresif dari 90% saham lain hari ini”. Cara ini membuat saham besar dan kecil bisa dibandingkan adil, dan tetap masuk akal saat seluruh pasar naik atau turun.",
      en: "What matters isn't “foreigners bought IDR 10B” but “foreigners bought this stock harder than 90% of others today”. This compares large and small caps fairly and still makes sense when the whole market moves.",
    },
    rejected: { id: "Angka mentah dan ambang tetap (rusak saat kondisi pasar berubah).", en: "Raw values and fixed thresholds (they break when the market changes)." },
  },
  {
    chose: { id: "Model sederhana yang bisa dijelaskan, bukan kotak hitam.", en: "A simple, explainable model, not a black box." },
    why: {
      id: "Dengan data ±15 bulan, model rumit cenderung menghafal kebetulan. Model sederhana bisa diurai: setiap skor di halaman saham dipecah menjadi alasan-alasannya, sehingga Anda tahu persis kenapa.",
      en: "With ~15 months of data, complex models memorise coincidences. A simple model can be unpacked: every score on a stock page breaks into its reasons, so you know exactly why.",
    },
    rejected: { id: "Model kompleks dengan angka uji tinggi tapi tidak bisa menjelaskan diri.", en: "Complex models that test well but can't explain themselves." },
  },
  {
    chose: { id: "Diuji seperti dipakai sungguhan, dengan jeda pengaman.", en: "Tested as if used for real, with a safety gap." },
    why: {
      id: "Model hanya boleh belajar dari masa lalu lalu dinilai pada periode sesudahnya, maju terus seperti waktu nyata. Ada jeda di antaranya supaya jawaban masa depan tidak bocor ke pelatihan. Banyak sistem terlihat hebat justru karena kebocoran ini.",
      en: "The model may only learn from the past and is graded on the period after, rolling forward like real time, with a gap so future answers never leak into training. Many systems look great precisely because of such leaks.",
    },
    rejected: { id: "Mengacak data latih dan uji (masa depan bocor, hasil terlihat terlalu bagus).", en: "Shuffling train and test data (the future leaks, results look too good)." },
    term: "walkForward",
  },
  {
    chose: { id: "Data bandar, fundamental, dan orang dalam ditampilkan, tapi tidak masuk skor.", en: "Broker, fundamental and insider data is shown, but kept out of the score." },
    why: {
      id: "Data ini hanya tersedia untuk kondisi hari ini, bukan untuk setiap hari di masa lalu. Memasukkannya ke uji berarti memakai informasi yang dulu belum ada. Kami memilih jujur daripada terlihat lebih pintar.",
      en: "This data only exists for today's state, not for every past day. Putting it in the test would use information that didn't exist back then. We chose honesty over looking smarter.",
    },
    rejected: { id: "Mencampur semua data ke satu skor supaya terlihat lebih meyakinkan.", en: "Blending everything into one score to look more convincing." },
    term: "broker",
  },
  {
    chose: { id: "Semua saham dengan transaksi median minimal Rp1 miliar/hari: 120 saham data lengkap + ratusan saham data dasar.", en: "Every stock trading at least IDR 1B/day on median: 120 full-data stocks plus hundreds on basic data." },
    why: {
      id: "Saham yang sangat sepi bisa digerakkan satu pihak dan merusak pola untuk semua saham, jadi batas Rp1 miliar adalah batas bawah. 120 saham utama punya histori harga, broker harian, dan berita dari Sectors; laporan keuangan dan valuasi dari Sectors tersedia untuk hampir semua saham. Harga, volume, dan dana asing saham lain memakai ringkasan perdagangan resmi BEI, gratis setiap hari. Preferensi lain seperti syariah, harga, sektor, dan ukuran adalah filter pilihan Anda.",
      en: "Very thin stocks can be moved by one party and corrupt the patterns for all, so IDR 1B is a floor. The 120 core stocks get price history, daily brokers and news from Sectors; Sectors statements and valuation cover almost every stock. Prices, volume and foreign flow for the rest come from the exchange's official daily summary, free every day. Other preferences like sharia, price, sector and size are your optional filters.",
    },
    rejected: { id: "Seluruh 900+ emiten (didominasi saham sepi).", en: "All 900+ listings (dominated by thin stocks)." },
    term: "liquidity",
  },
];

const ENDPOINTS: [string, Bi][] = [
  ["/v2/daily/{symbol}", { id: "Harga & volume harian ±1 tahun", en: "~1 year of daily prices & volume" }],
  ["/v2/foreign-flow/{symbol} · /v2/foreign-flow/", { id: "Dana asing per saham, seluruh pasar, dan pembaruan harian", en: "Foreign flow per stock, market-wide, and daily updates" }],
  ["/v2/index-daily/ihsg", { id: "IHSG untuk kekuatan relatif & kondisi pasar", en: "IHSG for relative strength & market mood" }],
  ["/v2/companies", { id: "200 emiten × 12 data fundamental; keanggotaan JII70 (syariah)", en: "200 companies × 12 fundamentals; JII70 (sharia) membership" }],
  ["/v2/broker-summary/{symbol}/top · /v2/brokers", { id: "Jejak bandar: institusi/ritel, asing/lokal", en: "Broker footprint: institutional/retail, foreign/local" }],
  ["/v2/filings · /v2/suspensions · /v2/corporate-actions", { id: "Orang dalam, suspensi, aksi korporasi", en: "Insiders, suspensions, corporate actions" }],
];

export function MethodView({ meta }: Pick<Bundle, "meta">) {
  const { tx, lang } = useLang();
  return (
    <div className="pt-7 sm:pt-9">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="max-w-3xl">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-balance sm:text-[2.4rem]">
          <T id="Cara Arus bekerja, dan kenapa begitu" en="How Arus works, and why" />
        </h1>
        <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-ink-2 sm:text-[15.5px]">
          <T
            id="Investor ritel kebanjiran data dan tips, tapi jarang tahu seberapa bisa dipercaya. Arus tidak menambah data. Ia menjawab satu pertanyaan, seberapa besar peluangnya, dengan angka yang bisa diperiksa dan berani bilang “tidak tahu”."
            en="Retail investors drown in data and tips but rarely know how far to trust them. Arus adds no more data. It answers one question, what are the odds, with a number you can audit that dares to say “I don't know”."
          />
        </p>
      </motion.header>

      <section id="ai" className="mt-11 scroll-mt-28 rounded-2xl bg-surface p-6 ring-1 ring-line sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight">
          <T id="Kenapa Arus disebut AI yang jujur?" en="Why call Arus an honest AI?" />
        </h2>
        <div className="mt-5 grid gap-8 md:grid-cols-3">
          {[
            {
              t: { id: "Belajar, bukan diatur", en: "It learns, not follows rules" },
              d: {
                id: "Banyak screener memakai aturan buatan manusia, misalnya “beli kalau harga di atas rata-rata 50 hari”. Arus tidak. Ia mempelajari sendiri dari data historis kondisi mana yang benar-benar menang, dan belajar ulang setiap hari saat pasar berubah. Hasilnya bahkan membantah kebiasaan umum: di periode ini, mengejar momentum justru kalah.",
                en: "Many screeners use human rules like “buy above the 50-day average”. Arus doesn't. It learns from historical data which conditions actually won, and relearns daily as markets change. It even contradicts common habit: in this period, chasing momentum lost.",
              },
            },
            {
              t: { id: "Yakin seperlunya", en: "Confident only as far as earned" },
              d: {
                id: "Setiap angka keyakinan sudah diuji: kalau Arus bilang 56 dari 100, kejadian serupa di masa uji memang menang sekitar 56 kali. Kalau buktinya tipis, skornya dekat 50 dan Arus bilang “netral”. AI yang baik bukan yang selalu yakin, tapi yang tahu kapan tidak yakin.",
                en: "Every confidence number is tested: when Arus says 56 of 100, similar cases in testing really won about 56 times. When evidence is thin, the score sits near 50 and Arus says “neutral”. Good AI isn't always sure; it knows when it isn't.",
              },
            },
            {
              t: { id: "Bisa diperiksa", en: "Auditable" },
              d: {
                id: "Setiap skor bisa dibongkar menjadi alasannya, setiap uji ditampilkan termasuk periode gagalnya, dan agen menilai dirinya sendiri setiap hari dalam rekam jejak yang tidak bisa diubah. Anda tidak diminta percaya; Anda diajak memeriksa.",
                en: "Every score unpacks into its reasons, every test is shown including the periods it failed, and the agent grades itself daily in a record that can't be edited. You're not asked to trust; you're invited to check.",
              },
            },
          ].map((x, i) => (
            <div key={i}>
              <h3 className="text-[15px] font-semibold text-arus">{tx(x.t)}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{tx(x.d)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-11">
        <h2 className="text-2xl font-semibold tracking-tight">
          <T id="Alurnya" en="The flow" />
        </h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {STEPS.map((s, i) => (
            <motion.li key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: i * 0.06, ease: EASE }} className="rounded-xl bg-surface p-4 ring-1 ring-line">
              <div className="num text-[12px] text-arus">{i + 1}</div>
              <div className="mt-1.5 text-[14px] font-medium text-ink">{tx(s.title)}</div>
              <div className="mt-1 text-[12.5px] leading-snug text-muted">{tx(s.body)}</div>
            </motion.li>
          ))}
        </ol>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">
          <T id="Keputusan yang kami ambil" en="The decisions we made" />
        </h2>
        <p className="mt-2 max-w-[70ch] text-[14px] text-muted">
          <T id="Setiap pilihan desain, alasannya, dan alternatif yang sengaja kami tolak." en="Every design choice, the reason behind it, and the alternative we deliberately rejected." />
        </p>
        <div className="mt-6 divide-y divide-line border-y border-line">
          {DECISIONS.map((d, i) => (
            <article key={i} className="grid gap-4 py-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
              <h3 className="text-[16px] font-medium leading-snug text-ink">
                {tx(d.chose)}
                {d.term && (
                  <span className="mt-2 block text-[12.5px] font-normal text-muted">
                    <Term k={d.term}>
                      <T id="Penjelasan singkat" en="Short explainer" />
                    </Term>
                  </span>
                )}
              </h3>
              <div className="space-y-3 text-[14px] leading-relaxed">
                <p className="text-ink-2">{tx(d.why)}</p>
                <p className="text-muted">
                  <span className="text-ink-2">
                    <T id="Yang kami tolak:" en="What we rejected:" />
                  </span>{" "}
                  {tx(d.rejected)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            <T id="Data Sectors yang dipakai" en="Sectors data we use" />
          </h2>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {ENDPOINTS.map(([e, d]) => (
              <li key={e} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] sm:gap-6">
                <code className="num break-words text-[12.5px] text-arus">{e}</code>
                <span className="text-[13.5px] text-ink-2">{tx(d)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            <T id="Hemat kuota data" en="Quota discipline" />
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-ink-2">
            <T
              id="Setiap jawaban dari Sectors disimpan permanen, jadi tidak ada data yang dibayar dua kali. Riwayat ±15 bulan cukup 5 panggilan per saham, data fundamental 200 emiten cukup 2 panggilan, laporan keuangan 5 tahun seluruh emiten cukup 2 panggilan, dan pembaruan harian memakai data seluruh pasar sekaligus."
              en="Every Sectors response is stored permanently, so nothing is paid for twice. ~15 months of history takes 5 calls per stock, fundamentals for 200 companies take 2 calls, five years of statements for every company take 2 calls, and daily updates use market-wide feeds."
            />
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-6">
            <div>
              <dt className="text-xs text-muted">
                <T id="Kredit terpakai" en="Credits used" />
              </dt>
              <dd className="num mt-1 text-3xl font-semibold">{Math.round(meta.credits_spent).toLocaleString(lang === "id" ? "id-ID" : "en-US")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">
                <T id="Panggilan API" en="API calls" />
              </dt>
              <dd className="num mt-1 text-3xl font-semibold">{meta.api_calls.toLocaleString(lang === "id" ? "id-ID" : "en-US")}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}

"use client";

import { motion } from "motion/react";
import { ArrowUpRight, Bot, Database, RefreshCcw, Send, ShieldCheck } from "lucide-react";
import { T, useLang, type Bi } from "@/lib/i18n";
import { dateLabel } from "@/lib/format";
import { VERDICT } from "@/lib/verdict";

type Track = { days: { picked_on: string; graded_on: string; groups: Record<string, { n: number; won: number; ret: number }> }[]; totals: Record<string, { n: number; won: number }> };
const EASE = [0.23, 1, 0.32, 1] as const;

/** Render the digest's tiny HTML subset (<b>, <i>) without innerHTML. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <span key={i} className="block min-h-[1.2em]">
          {line.split(/(<b>.*?<\/b>|<i>.*?<\/i>)/g).map((part, j) =>
            part.startsWith("<b>") ? (
              <strong key={j} className="font-semibold text-ink">{part.slice(3, -4)}</strong>
            ) : part.startsWith("<i>") ? (
              <em key={j} className="text-muted">{part.slice(3, -4)}</em>
            ) : (
              <span key={j}>{part}</span>
            ),
          )}
        </span>
      ))}
    </>
  );
}

const STEPS: { icon: React.ReactNode; time: Bi; title: Bi; body: Bi }[] = [
  {
    icon: <Database size={18} />,
    time: { id: "± 17.45 WIB", en: "~5:45 pm WIB" },
    title: { id: "Ambil data baru", en: "Fetch fresh data" },
    body: { id: "Setelah bursa tutup dan data final, agen menarik harga, volume, dan dana asing hari itu dari Sectors. Hanya hari baru yang diambil, jadi hemat kuota.", en: "After the close, once data is final, the agent pulls the day's prices, volume and foreign flow from Sectors. Only new days are fetched, saving quota." },
  },
  {
    icon: <RefreshCcw size={18} />,
    time: { id: "± 1 menit", en: "~1 minute" },
    title: { id: "Belajar ulang", en: "Re-learn" },
    body: { id: "Model dilatih ulang dengan data terbaru dan diuji lagi. Kalau pola pasar berubah, bobot sinyal ikut berubah. Tidak ada aturan yang dikunci manual.", en: "The model retrains on the newest data and is re-tested. If market patterns shift, signal weights shift too. No rule is hard-coded." },
  },
  {
    icon: <ShieldCheck size={18} />,
    time: { id: "otomatis", en: "automatic" },
    title: { id: "Menilai diri sendiri", en: "Grade itself" },
    body: { id: "Penilaian “besok” yang dibuat kemarin dicocokkan dengan hasil hari ini dan dicatat permanen. Rekam jejak ini tidak bisa diubah belakangan.", en: "Yesterday's “next day” verdicts are checked against today's outcome and logged permanently. The record can't be edited afterwards." },
  },
  {
    icon: <Send size={18} />,
    time: { id: "langsung", en: "instantly" },
    title: { id: "Kirim ke Telegram", en: "Send to Telegram" },
    body: { id: "Ringkasan masuk ke HP Anda: saham paling diunggulkan dan bertanda waspada, kejadian tak biasa, status saham pantauan, dan rapor kemarin.", en: "A digest lands on your phone: strongest and caution-flagged stocks, unusual events, your watchlist status, and yesterday's report card." },
  },
];

const COMMANDS: [string, Bi][] = [
  ["/hari_ini", { id: "Ringkasan hari ini, termasuk saham pantauan Anda", en: "Today's digest, including your watchlist" }],
  ["/saham BBRI", { id: "Skor besok, gerak normal, batas bawah/atas, batas sinyal batal", en: "Next-day score, normal move, floor/ceiling, invalidation" }],
  ["/unggul", { id: "10 saham paling diunggulkan", en: "Top 10 strong-edge stocks" }],
  ["/waspada", { id: "10 saham bertanda waspada", en: "10 caution-flagged stocks" }],
  ["/pantau KODE", { id: "Tambah saham ke pantauan (ikut dilaporkan setiap hari)", en: "Add to watchlist (reported daily)" }],
  ["/rapor", { id: "Rekam jejak live Arus sejak agen berjalan", en: "Arus' live track record since the agent started" }],
  ["/syariah on", { id: "Hanya tampilkan saham syariah di semua daftar dan ringkasan", en: "Show only sharia stocks in every list and digest" }],
  ["/harga 1000", { id: "Hanya saham berharga di bawah batas ini (/harga semua untuk hapus)", en: "Only stocks priced below this (/harga semua to clear)" }],
  [`"BBRI layak dipantau?"`, { id: "Sebut kode saham dalam kalimat biasa; dibalas kartu saham itu", en: "Name a stock in plain words; you get that stock's card" }],
  ["/bahasa en", { id: "Ganti bahasa", en: "Switch language" }],
];

export function AgentView({ digest, track }: { digest: { as_of: string; id: string; en: string }; track: Track }) {
  const { tx, lang } = useLang();
  const t = track.totals ?? {};
  const strong = t.strong;
  const caution = t.caution;
  return (
    <div className="pt-7 sm:pt-9">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="max-w-3xl">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-balance sm:text-[2.4rem]">
          <T id="Arus tetap bekerja saat Anda tidak membuka web" en="Arus keeps working when you're not looking" />
        </h1>
        <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-ink-2 sm:text-[15.5px]">
          <T
            id="Sebuah agen otomatis menjalankan seluruh proses setiap hari bursa: mengambil data, belajar ulang, menilai dirinya sendiri, lalu mengirim ringkasan ke Telegram. Anda cukup membaca dan memutuskan."
            en="An automated agent runs the whole process every trading day: fetch data, re-learn, grade itself, then send a digest to Telegram. You just read and decide."
          />
        </p>
      </motion.header>

      <ol className="mt-10 grid gap-8 md:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((s, i) => (
          <motion.li key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 + i * 0.07, ease: EASE }} className="border-t border-line pt-5">
            <div className="flex items-center justify-between">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-arus/12 text-arus">{s.icon}</span>
              <span className="num text-[12px] text-muted">{tx(s.time)}</span>
            </div>
            <h3 className="mt-4 text-[15px] font-semibold">{tx(s.title)}</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{tx(s.body)}</p>
          </motion.li>
        ))}
      </ol>

      <section className="mt-16 grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-14">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            <T id="Rekam jejak live" en="Live track record" />
          </h2>
          <p className="mt-2 max-w-[65ch] text-[14px] leading-relaxed text-muted">
            <T
              id="Berbeda dari uji historis, ini penilaian sungguhan setelah Arus dijalankan: setiap hari, apakah saham yang ditandai kemarin benar-benar berakhir di separuh atas atau bawah."
              en="Unlike the historical test, this is real grading after Arus went live: every day, did yesterday's flagged stocks actually end in the top or bottom half."
            />
          </p>
          {track.days.length === 0 ? (
            <div className="mt-6 rounded-xl bg-surface p-5 text-[14px] leading-relaxed text-ink-2 ring-1 ring-line">
              <T id="Rekam jejak dimulai setelah hari bursa pertama sejak agen dinyalakan. Data terakhir:" en="The record starts after the first trading day since the agent was switched on. Latest data:" />{" "}
              <span className="text-ink">{dateLabel(digest.as_of, lang)}</span>.
            </div>
          ) : (
            <>
              <dl className="mt-6 grid grid-cols-2 gap-6">
                {strong && (
                  <div>
                    <dt className={`text-[13px] ${VERDICT.strong.text}`}>{tx(VERDICT.strong.label)}</dt>
                    <dd className="num mt-1 text-3xl font-semibold">
                      {strong.won}/{strong.n}
                    </dd>
                    <dd className="text-[12px] text-muted"><T id="berakhir di separuh atas" en="ended in the top half" /></dd>
                  </div>
                )}
                {caution && (
                  <div>
                    <dt className={`text-[13px] ${VERDICT.caution.text}`}>{tx(VERDICT.caution.label)}</dt>
                    <dd className="num mt-1 text-3xl font-semibold">
                      {caution.n - caution.won}/{caution.n}
                    </dd>
                    <dd className="text-[12px] text-muted"><T id="memang tertinggal" en="did lag" /></dd>
                  </div>
                )}
              </dl>
              <ul className="mt-6 divide-y divide-line border-y border-line text-[13px]">
                {[...track.days].reverse().map((d) => (
                  <li key={d.picked_on} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="text-ink-2">
                      {dateLabel(d.picked_on, lang)} → {dateLabel(d.graded_on, lang)}
                    </span>
                    <span className="num text-muted">
                      {d.groups.strong && <>{tx(VERDICT.strong.short)} {d.groups.strong.won}/{d.groups.strong.n}</>}
                      {d.groups.caution && <> · {tx(VERDICT.caution.short)} {d.groups.caution.n - d.groups.caution.won}/{d.groups.caution.n}</>}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 className="mt-11 text-2xl font-semibold tracking-tight">
            <T id="Perintah bot Telegram" en="Telegram bot commands" />
          </h2>
          <ul className="mt-5 divide-y divide-line border-y border-line">
            {COMMANDS.map(([c, d]) => (
              <li key={c} className="grid gap-1 py-3 sm:grid-cols-[190px_minmax(0,1fr)] sm:gap-6">
                <code className="num text-[13px] text-arus">{c}</code>
                <span className="text-[13.5px] text-ink-2">{tx(d)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] leading-relaxed text-muted">
            <T
              id="Bot membaca hasil analisis yang sudah tersimpan, jadi bertanya sesering apa pun tidak menghabiskan kuota data."
              en="The bot reads the stored analysis, so asking as often as you like never spends data quota."
            />
          </p>
        </div>

        <div>
          <div className="flex items-center gap-2 text-[13px] text-muted">
            <Bot size={16} className="text-arus" />
            <T id="Ringkasan yang dikirim untuk" en="Digest sent for" /> {dateLabel(digest.as_of, lang)}
          </div>
          <div className="mt-3 rounded-2xl bg-[#17212b] p-4 ring-1 ring-line">
            <div className="rounded-xl rounded-tl-sm bg-[#182533] px-4 py-3 text-[13px] leading-relaxed text-ink-2 shadow-[0_1px_0_rgb(0_0_0/0.3)]">
              <Rich text={lang === "id" ? digest.id : digest.en} />
            </div>
          </div>
          <p className="mt-3 text-[12px] text-muted">
            <T id="Isi di atas adalah keluaran asli agen, bukan contoh rekaan. Saham pantauan contoh: BBCA, TLKM." en="The message above is the agent's real output, not a mock-up. Example watchlist: BBCA, TLKM." />
          </p>

          <a
            href="https://t.me/nab_arus_bot"
            target="_blank"
            rel="noreferrer"
            className="group mt-8 flex items-center gap-4 rounded-2xl bg-arus/10 p-5 ring-1 ring-arus/40 transition-colors duration-150 hover:bg-arus/15"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-arus text-ground">
              <Send size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-ink">
                <T id="Buka bot Arus di Telegram" en="Open the Arus bot on Telegram" />
              </span>
              <span className="block text-[13px] text-ink-2">@nab_arus_bot · <T id="ketik /start, gratis" en="type /start, free" /></span>
            </span>
            <ArrowUpRight size={18} className="shrink-0 text-arus transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </div>
      </section>

      <section className="mt-16 max-w-3xl rounded-2xl bg-surface p-6 ring-1 ring-line">
        <h2 className="text-lg font-semibold">
          <T id="Bagaimana dengan trading menit-ke-menit?" en="What about minute-by-minute trading?" />
        </h2>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">
          <T
            id="Data Sectors bersifat harian (final setelah bursa tutup), jadi Arus tidak mengikuti harga detik-ke-detik. Cara memakainya untuk trading harian: malam sebelumnya, pilih kandidat dari skor “Besok” dan catat level pentingnya (gerak normal, batas bawah/atas, batas sinyal batal). Besok paginya, pantau eksekusi di aplikasi sekuritas Anda dengan level itu sebagai patokan."
            en="Sectors data is daily (final after the close), so Arus doesn't track prices second by second. To use it for day trading: the evening before, shortlist candidates from the “Next day” score and note their key levels (normal move, floor/ceiling, invalidation). The next morning, watch execution in your broker app using those levels as anchors."
          />
        </p>
      </section>
    </div>
  );
}

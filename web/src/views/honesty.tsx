"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { DecileBars, DivergingBars, Reliability } from "@/components/charts/analytics";
import { EquityChart } from "@/components/charts/equity";
import { ChartTitle } from "@/components/charts/kit";
import { Term } from "@/components/term";
import { HorizonToggle } from "@/components/ui";
import { FAMILY, type FamilyKey } from "@/lib/features";
import { dateLabel, signed } from "@/lib/format";
import { T, useLang } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import type { Bundle } from "@/lib/types";
import { HORIZON_LABEL } from "@/lib/verdict";

const EASE = [0.23, 1, 0.32, 1] as const;

export function HonestyView({ meta, models }: Pick<Bundle, "meta" | "models">) {
  const { tx, lang } = useLang();
  const { horizon } = usePrefs();
  const [tech, setTech] = useState(false);
  const M = models[String(horizon) as "1" | "20"];
  const m = M.metrics;
  const top = Math.round(m.top_decile_hit * 100);
  const bot = Math.round(m.bottom_decile_hit * 100);
  const when = tx(HORIZON_LABEL[horizon].long);

  const answers = [
    {
      q: { id: "Apakah saham yang dinilai tinggi benar-benar lebih sering unggul?", en: "Do highly rated stocks really win more often?" },
      big: `${top} vs ${bot}`,
      a: {
        id: `Ya, walau selisihnya sederhana. Pada periode uji, saham "Sangat diunggulkan" unggul ${top} dari 100 kali ${when}, sedangkan saham "Waspada" hanya ${bot} dari 100. Lempar koin = 50.`,
        en: `Yes, though modestly. In testing, "Strong edge" stocks won ${top} of 100 times ${when}, while "Caution" stocks won only ${bot} of 100. A coin flip = 50.`,
      },
    },
    {
      q: { id: "Berapa selisih hasilnya dalam rupiah?", en: "What's the gap in returns?" },
      big: `${signed(m.top_decile_excess * 100, 1, "%")} vs ${signed(m.bottom_decile_excess * 100, 1, "%")}`,
      a: {
        id: `Dibanding IHSG ${when}, kelompok teratas rata-rata bergerak ${signed(m.top_decile_excess * 100, 2, "%")}, kelompok terbawah ${signed(m.bottom_decile_excess * 100, 2, "%")}. Belum termasuk biaya transaksi.`,
        en: `Against IHSG ${when}, the top group moved ${signed(m.top_decile_excess * 100, 2, "%")} on average and the bottom group ${signed(m.bottom_decile_excess * 100, 2, "%")}. Before trading costs.`,
      },
    },
    {
      q: { id: "Apakah hasilnya konsisten dari waktu ke waktu?", en: "Is it consistent over time?" },
      big: `${m.folds_beating_chance}/${m.n_folds}`,
      a: {
        id: `Kami membagi masa uji menjadi ${m.n_folds} periode berurutan. Arus lebih baik dari lempar koin di ${m.folds_beating_chance} periode. ${m.folds_beating_chance < m.n_folds ? "Ada periode di mana Arus tidak bekerja, dan kami menampilkannya." : ""}`,
        en: `We split testing into ${m.n_folds} consecutive periods. Arus beat a coin flip in ${m.folds_beating_chance}. ${m.folds_beating_chance < m.n_folds ? "There were periods where it didn't work, and we show them." : ""}`,
      },
    },
    {
      q: { id: "Di mana Arus paling bisa diandalkan?", en: "Where is Arus most reliable?" },
      big: tx({ id: "Tanda Waspada", en: "Caution flags" }),
      a: {
        id: `Arus lebih jago mengenali saham yang akan tertinggal daripada menebak juara. ${100 - bot} dari 100 saham bertanda Waspada memang berakhir di separuh bawah. Gunakan ini sebagai saringan pertama.`,
        en: `Arus is better at spotting laggards than picking champions. ${100 - bot} of 100 Caution-flagged stocks did end in the bottom half. Use it as a first filter.`,
      },
    },
  ];

  return (
    <div className="pt-10 sm:pt-12">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="max-w-3xl">
        <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-balance sm:text-5xl">
          <T id="Apakah Arus benar-benar bekerja?" en="Does Arus actually work?" />
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
          <T
            id="Kami menguji Arus seperti dipakai sungguhan: model hanya belajar dari masa lalu, lalu dinilai pada bulan-bulan sesudahnya yang belum pernah ia lihat. Ini hasilnya, apa adanya."
            en="We tested Arus as if used for real: the model learns only from the past, then is graded on later months it has never seen. Here are the results, as they are."
          />
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-[13px] text-muted">
          <HorizonToggle />
          <span>
            <T id="Periode uji" en="Test period" /> {dateLabel(m.oos_start, lang)} → {dateLabel(m.oos_end, lang)}
          </span>
        </div>
      </motion.header>

      <section className="mt-12 rounded-2xl bg-surface p-5 ring-1 ring-line sm:p-7">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          <T id="Kalau sejak April mengikuti Arus" en="If you had followed Arus since April" />
        </h2>
        <p className="mt-2 max-w-[75ch] text-[14px] leading-relaxed text-muted">
          {horizon === 20 ? (
            <T
              id="Simulasi backtest out-of-sample: setiap hari 1/20 dana dipindah ke saham “Sangat diunggulkan” dan ditahan sebulan (cara standar membagi dana menjadi 20 tahap). Garis nol = IHSG. Garis putus-putus sudah dikurangi biaya transaksi ±0,4% per putaran."
              en="Out-of-sample backtest: each day 1/20 of the money moves into “Strong edge” stocks and is held a month (the standard 20-tranche method). Zero line = IHSG. The dashed line deducts ~0.4% trading cost per round trip."
            />
          ) : (
            <T
              id="Simulasi backtest out-of-sample: setiap hari membeli saham “Sangat diunggulkan” dan menjualnya besok. Garis nol = IHSG. Garis putus-putus sudah dikurangi biaya ±0,4% per hari, dan hasilnya negatif: skor besok berguna sebagai saringan dan penentu waktu, bukan untuk beli-jual setiap hari."
              en="Out-of-sample backtest: buy “Strong edge” stocks each day and sell next day. Zero line = IHSG. The dashed line deducts ~0.4% daily cost and turns negative: the next-day score is a filter and timing aid, not a daily trading strategy."
            />
          )}
        </p>
        <div className="mt-6">
          <EquityChart data={M.equity} />
        </div>
      </section>

      <div className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
        {answers.map((x, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 + i * 0.07, ease: EASE }} className="border-t border-line pt-6">
            <h2 className="text-[16px] font-semibold leading-snug text-ink">{tx(x.q)}</h2>
            <div className="num mt-3 text-3xl font-semibold tracking-tight text-arus">{x.big}</div>
            <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">{tx(x.a)}</p>
          </motion.div>
        ))}
      </div>

      <section className="mt-16">
        <ChartTitle
          note={tx({
            id: "Setiap hari semua saham dibagi 10 kelompok menurut skornya. Kalau skor berarti, batang kanan lebih tinggi dari kiri. Garis kuning = lempar koin.",
            en: "Each day all stocks are split into 10 groups by score. If the score means anything, right bars stand taller than left. Yellow line = coin flip.",
          })}
        >
          <T id="Seberapa sering setiap kelompok skor unggul" en="How often each score group won" />
        </ChartTitle>
        <DecileBars rows={M.deciles} base={0.5} />
      </section>

      <section className="mt-16 max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight">
          <T id="Yang tidak kami janjikan" en="What we don't promise" />
        </h2>
        <ul className="mt-5 space-y-4 text-[15px] leading-relaxed text-ink-2">
          {[
            {
              id: "Arus tidak bisa melihat masa depan. Skor 56 berarti 44 dari 100 kejadian serupa justru kalah.",
              en: "Arus cannot see the future. A score of 56 means 44 of 100 similar cases lost.",
            },
            {
              id: "Data kami setahun terakhir, sebagian besar di pasar yang sedang turun. Di pasar yang berbeda, pola bisa berubah. Karena itu model dilatih ulang setiap hari.",
              en: "Our data covers the past year, mostly a falling market. In a different market patterns can change, which is why the model retrains every day.",
            },
            {
              id: "Saham yang diuji adalah yang aktif hari ini. Saham yang sudah tidak aktif tidak ikut diuji, dan itu bisa membuat hasil terlihat sedikit lebih baik.",
              en: "Tested stocks are the ones active today. Stocks that went quiet aren't included, which can flatter results slightly.",
            },
            {
              id: "Belum termasuk biaya transaksi dan selisih harga saat membeli. Unggul secara statistik belum tentu untung setelah biaya.",
              en: "Trading costs and slippage are not included. A statistical edge isn't the same as profit after costs.",
            },
            {
              id: "Arus memberi informasi, bukan perintah. Keputusan membeli atau menjual tetap milik Anda.",
              en: "Arus gives information, not orders. Buying or selling remains your decision.",
            },
          ].map((l, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
              {tx(l)}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16 max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight">
          <T id="Yang kami coba lalu tinggalkan" en="What we tried and dropped" />
        </h2>
        <ul className="mt-5 space-y-4 text-[15px] leading-relaxed text-ink-2">
          <li>
            <span className="font-medium text-ink">
              <T id="Target “mengalahkan IHSG”." en="A “beat IHSG” target." />
            </span>{" "}
            <T
              id="Peluang saham acak mengalahkan IHSG berayun 44%–58% antar bulan, tergantung nasib segelintir saham raksasa di indeks. Tidak ada sinyal yang bisa menebak itu, dan angkanya jadi menyesatkan. Kami ganti dengan “unggul dari separuh saham lain”, yang selalu 50% untuk pilihan acak."
              en="A random stock's odds of beating IHSG swung between 44% and 58% month to month, driven by a few index giants. No signal can foresee that, and the numbers misled. We switched to “beating half of all other stocks”, which is always 50% for a random pick."
            />
          </li>
          <li>
            <span className="font-medium text-ink">
              <T id="Skor kalibrasi bertangga." en="A stepwise calibration." />
            </span>{" "}
            <T
              id="Metode pertama menghasilkan angka ekstrem seperti 0% dan 74% di ujung-ujungnya, karena terlalu menghafal sedikit kejadian. Kami ganti dengan kurva halus yang jujur di kisaran 43–57."
              en="Our first method produced extremes like 0% and 74% at the edges by memorising a handful of cases. We replaced it with a smooth curve that stays honest within 43–57."
            />
          </li>
          <li>
            <span className="font-medium text-ink">
              <T id="Mengejar momentum dan dana asing." en="Chasing momentum and foreign money." />
            </span>{" "}
            <T
              id="Banyak screener memberi nilai tinggi pada saham yang sedang naik dan diborong asing. Di data setahun terakhir, cara itu justru sedikit di bawah lempar koin. Arus belajar dari data, bukan dari kebiasaan."
              en="Many screeners rate stocks highly when they're rising and foreigners are buying. Over the past year that approach did slightly worse than a coin flip. Arus learns from data, not habit."
            />
          </li>
        </ul>
      </section>

      {/* TECHNICAL */}
      <section className="mt-16">
        <button onClick={() => setTech((t) => !t)} aria-expanded={tech} className="flex w-full cursor-pointer items-center justify-between gap-3 border-y border-line py-4 text-left">
          <span>
            <span className="block text-[16px] font-semibold">
              <T id="Detail teknis untuk yang ingin tahu" en="Technical details for the curious" />
            </span>
            <span className="text-[13px] text-muted">
              <T id="AUC, kalibrasi, stabilitas per periode, kekuatan tiap kelompok sinyal" en="AUC, calibration, per-period stability, strength of each signal group" />
            </span>
          </span>
          <ChevronDown size={18} className={`shrink-0 text-muted transition-transform duration-200 ${tech ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence initial={false}>
          {tech && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
              <dl className="grid grid-cols-2 gap-x-8 gap-y-6 py-8 md:grid-cols-5">
                {[
                  [<Term key="a" k="auc">AUC</Term>, m.auc_model.toFixed(3), tx({ id: `median per periode ${m.auc_by_fold_median.toFixed(3)}`, en: `median per period ${m.auc_by_fold_median.toFixed(3)}` })],
                  [tx({ id: "AUC skor naif", en: "Naive score AUC" }), m.auc_naive.toFixed(3), tx({ id: "bobot sama tanpa belajar", en: "equal weights, no learning" })],
                  [<Term key="b" k="brier">Brier skill</Term>, `${signed(m.brier_skill * 100, 1)}%`, tx({ id: `ketat (sekuensial) ${signed(m.brier_skill_sequential * 100, 1)}%`, en: `strict (sequential) ${signed(m.brier_skill_sequential * 100, 1)}%` })],
                  [tx({ id: "Pengamatan uji", en: "Test observations" }), m.n_obs.toLocaleString(), tx({ id: `≈${Math.round(m.n_effective).toLocaleString()} independen`, en: `≈${Math.round(m.n_effective).toLocaleString()} independent` })],
                  [tx({ id: "Regularisasi", en: "Regularisation" }), `L2 = ${m.final_l2}`, tx({ id: "dipilih lewat validasi bersarang", en: "chosen by nested validation" })],
                ].map(([l, val, note], i) => (
                  <div key={i}>
                    <dt className="text-xs text-muted">{l}</dt>
                    <dd className="num mt-1 text-2xl font-semibold tracking-tight">{val}</dd>
                    <dd className="mt-1 text-[12px] leading-snug text-muted">{note}</dd>
                  </div>
                ))}
              </dl>
              <div className="grid gap-14 lg:grid-cols-2">
                <div>
                  <ChartTitle note={tx({ id: "Titik di garis diagonal = angka peluang Arus sesuai kenyataan.", en: "Dots on the diagonal = Arus' odds match reality." })}>
                    <T id="Diagram kalibrasi" en="Calibration diagram" />
                  </ChartTitle>
                  <Reliability rows={M.reliability} />
                </div>
                <div>
                  <ChartTitle note={tx({ id: "AUC tiap periode uji. Merah = periode di mana Arus tidak lebih baik dari acak.", en: "AUC per test period. Red = periods where Arus was no better than random." })}>
                    <T id="Stabilitas per periode" en="Stability per period" />
                  </ChartTitle>
                  <DivergingBars
                    center={0.5}
                    rowHeight={28}
                    format={(v) => v.toFixed(3)}
                    rows={M.folds.map((f) => ({ key: f.test_start, label: `${dateLabel(f.test_start, lang, { year: "2-digit" })} → ${dateLabel(f.test_end, lang, { year: "2-digit" })}`, value: f.auc }))}
                  />
                </div>
                <div>
                  <ChartTitle note={tx({ id: "Kekuatan tiap kelompok sinyal kalau dipakai sendirian dengan arah yang umum dipercaya. Merah = arah umum justru salah di periode ini.", en: "Each signal group used alone in its commonly believed direction. Red = the common belief was wrong in this period." })}>
                    <T id="Kelompok sinyal sendiri-sendiri" en="Signal groups on their own" />
                  </ChartTitle>
                  <DivergingBars
                    center={0.5}
                    format={(v) => v.toFixed(3)}
                    rows={[...M.familyAuc].sort((a, b) => b.auc - a.auc).map((f) => ({ key: f.family, label: tx(FAMILY[f.family as FamilyKey]?.label ?? { id: f.family, en: f.family }), value: f.auc }))}
                  />
                </div>
                <div className="text-[13.5px] leading-relaxed text-ink-2">
                  <h3 className="mb-3 text-[15px] font-semibold text-ink">
                    <T id="Metode singkat" en="Method in brief" />
                  </h3>
                  <p>
                    <T
                      id={`Label: apakah saham berakhir di atas median saham likuid ${when}. Model: regresi logistik dengan regularisasi L2 pada persentil harian 14 sinyal. Validasi: walk-forward per 20 hari bursa dengan jeda ${horizon} hari antara data latih dan uji. Kalibrasi: kurva Platt pada peringkat harian skor. Rentang kepercayaan: Wilson dengan N efektif = pengamatan ÷ ${horizon}.`}
                      en={`Label: whether the stock finished above the median liquid stock ${when}. Model: L2-regularised logistic regression on daily percentiles of 14 signals. Validation: walk-forward in 20-session blocks with a ${horizon}-day gap between train and test. Calibration: a Platt curve on the daily rank of the score. Intervals: Wilson with effective N = observations ÷ ${horizon}.`}
                    />
                  </p>
                  <p className="mt-3 text-muted">
                    <Term k="walkForward">
                      <T id="Kenapa diuji seperti waktu nyata?" en="Why test like real time?" />
                    </Term>
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
      <p className="mt-10 text-[12px] text-muted">
        <T id="Riwayat data sejak" en="Data history since" /> {dateLabel(meta.history_start, lang)}.
      </p>
    </div>
  );
}

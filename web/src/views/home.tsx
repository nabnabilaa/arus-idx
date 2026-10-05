"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, BarChart3, ChevronDown, Globe, LayoutGrid, Search, SlidersHorizontal, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { FlowField } from "@/components/flow-field";
import { MarketMap } from "@/components/charts/treemap";
import { Term } from "@/components/term";
import { Badge, HorizonToggle, Reason, ScoreBar, Segmented, StarButton, Toggle } from "@/components/ui";
import { FEATURE, SECTOR_ID, SUBSECTOR_ID } from "@/lib/features";
import { dateLabel, idr, price, signed } from "@/lib/format";
import { T, useLang, type Bi } from "@/lib/i18n";
import { DEFAULT_HORIZON, PUBLISHED } from "@/lib/published";
import { MarketBrief } from "@/components/brief";
import { AgendaWeek } from "@/components/agenda";
import { MacroStrip } from "@/components/macro-strip";
import { Explore, type ExploreStats } from "@/components/explore";
import { FIN_GRADE } from "@/components/perspectives";
import { RISK, riskFlags } from "@/lib/risk";
import { Pager } from "@/components/pager";
import { usePrefs } from "@/lib/prefs";
import type { AgendaItem, Bundle, FeatureKey, Horizon, Stock } from "@/lib/types";
import { get, HORIZON_LABEL, VERDICT, VERDICT_ORDER, verdictOf, type VerdictKey } from "@/lib/verdict";

type Props = Pick<Bundle, "ranking" | "meta" | "market" | "models" | "sectors" | "macro"> & { agenda: AgendaItem[]; explore: ExploreStats };
const EASE = [0.23, 1, 0.32, 1] as const;

export function HomeView({ ranking, meta, market, models, sectors, agenda, macro, explore }: Props) {
  const { horizon } = usePrefs();
  const model = models[String(horizon) as "1" | "20"];

  const ranked = useMemo(() => new Set(ranking.map((s) => s.symbol)), [ranking]);
  const scored = useMemo(
    () => ranking.map((s) => ({ s, g: get(s, horizon), v: verdictOf(get(s, horizon).q) })).sort((a, b) => b.g.conf - a.g.conf),
    [ranking, horizon],
  );

  return (
    <>
      <Hero ranking={ranking} meta={meta} />
      <MacroStrip market={market} macro={macro} asOf={meta.as_of} />
      <Explore st={explore} />
      <MarketBrief ranking={ranking} market={market} sectors={sectors} asOf={meta.as_of} />
      <AgendaWeek items={agenda} ranked={ranked} asOf={meta.as_of} />
      <HowToRead />
      <MarketToday ranking={ranking} market={market} horizon={horizon} model={model} />
      <Highlights scored={scored} />
      <Screener scored={scored} />
    </>
  );
}

/* ------------------------------------------------------------------ hero */
function Hero({ ranking, meta }: { ranking: Stock[]; meta: Bundle["meta"] }) {
  const { tx, lang } = useLang();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const matches = q.trim()
    ? ranking.filter((s) => s.symbol.toLowerCase().startsWith(q.trim().toLowerCase()) || (s.name ?? "").toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
    : [];
  return (
    <section className="relative -mx-4 px-4 pb-12 pt-12 sm:-mx-6 sm:px-6 sm:pt-16">
      <div className="absolute inset-0 overflow-hidden">
        <FlowField />
      </div>
      <motion.div initial={{ opacity: 0, y: 12, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.6, ease: EASE }} className="relative max-w-3xl">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-surface/80 px-3 py-1 text-[12px] text-ink-2 ring-1 ring-line backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-good" />
          <T id="Data bursa per" en="Market data as of" /> {dateLabel(meta.as_of, lang, { weekday: "long" })}
        </p>
        <h1 className="text-[2.1rem] font-semibold leading-[1.1] tracking-[-0.03em] text-balance sm:text-5xl lg:text-[3.4rem]">
          <T id="Lihat apa yang terjadi di balik setiap saham." en="See what is happening behind every stock." />
        </h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-2 text-pretty sm:text-[17px]">
          <T
            id={`Siapa yang membeli, apa yang dilakukan orang dalam, seberapa sehat perusahaannya, dan apa yang biasanya terjadi sesudahnya. Untuk ${meta.n_ranked} saham paling aktif di BEI, dari data Sectors dan BEI, diperbarui setiap hari bursa. Setiap angka punya rapornya.`}
            en={`Who is buying, what insiders are doing, how healthy the company is, and what usually happens next. For the ${meta.n_ranked} most active IDX stocks, from Sectors and IDX data, refreshed every trading day. Every number comes with its report card.`}
          />
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15, ease: EASE }} className="relative mt-8 flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label className="flex h-12 items-center gap-3 rounded-xl bg-surface/90 px-4 ring-1 ring-line-strong backdrop-blur focus-within:ring-arus/70">
            <Search size={18} className="shrink-0 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setFocus(true)}
              onBlur={() => setTimeout(() => setFocus(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches[0]) router.push(`/saham/${matches[0].symbol}/`);
              }}
              placeholder={tx({ id: "Cari saham, misal BBRI atau Telkom", en: "Search a stock, e.g. BBRI or Telkom" })}
              className="w-full bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none"
              aria-label={tx({ id: "Cari saham", en: "Search stocks" })}
            />
          </label>
          <AnimatePresence>
            {focus && matches.length > 0 && (
              <motion.ul
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
                transition={{ duration: 0.15, ease: EASE }}
                className="absolute inset-x-0 top-14 z-40 overflow-hidden rounded-xl bg-raised ring-1 ring-line-strong shadow-[0_20px_50px_-12px_rgb(0_0_0/0.8)]"
              >
                {matches.map((s) => (
                  <li key={s.symbol}>
                    <Link href={`/saham/${s.symbol}/`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface">
                      <span>
                        <span className="font-semibold">{s.symbol}</span> <span className="text-[13px] text-muted">{s.name}</span>
                      </span>
                      <ArrowUpRight size={15} className="text-muted" />
                    </Link>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
        <HorizonToggle size="lg" />
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ how to read */
function HowToRead() {
  const { tx } = useLang();
  const [open, setOpen] = useState(false);
  const steps = [
    PUBLISHED.length > 1
      ? {
          t: { id: "Pilih jangka waktu", en: "Pick a time horizon" },
          d: {
            id: "“Besok” untuk trading harian. “1 bulan” untuk swing atau investasi. Arus menghitung keduanya terpisah.",
            en: "“Next day” for day trading. “1 month” for swing or investing. Arus scores each separately.",
          },
          vis: <HorizonToggle />,
        }
      : {
          t: { id: "Skor untuk hari bursa berikutnya", en: "A score for the next session" },
          d: {
            id: `Arus menilai peluang tiap saham ${tx(HORIZON_LABEL[DEFAULT_HORIZON].long)}, diperbarui setiap sore setelah bursa tutup.`,
            en: `Arus rates each stock's odds ${tx(HORIZON_LABEL[DEFAULT_HORIZON].long)}, refreshed every afternoon after the close.`,
          },
          vis: <Badge>{tx(HORIZON_LABEL[DEFAULT_HORIZON].name)}</Badge>,
        },
    {
      t: { id: "Baca skornya", en: "Read the score" },
      d: {
        id: "Skor besok 56 artinya: dari 100 hari dengan kondisi mirip, 56 kali saham seperti ini bergerak lebih baik dari separuh saham lain esok harinya. 50 berarti sama saja dengan memilih acak.",
        en: "A next-day score of 56 means: out of 100 days with a similar setup, 56 times a stock like this beat half of all others the next day. 50 means no better than picking at random.",
      },
      vis: (
        <div className="w-full max-w-56">
          <ScoreBar value={0.56} lo={0.5} hi={0.61} color="#5cc8ff" />
          <div className="num mt-1 flex justify-between text-[10.5px] text-muted">
            <span>40</span>
            <span>50 · {tx({ id: "acak", en: "random" })}</span>
            <span>60</span>
          </div>
        </div>
      ),
    },
    {
      t: { id: "Klik untuk alasannya", en: "Click for the why" },
      d: {
        id: "Setiap saham punya halaman dengan tiga sudut pandang: besok, beberapa minggu, dan jangka panjang. Ada juga perencana CL/TP, jejak bandar, dan kesehatan keuangannya.",
        en: "Every stock has a page with three views: tomorrow, a few weeks, and the long term. Plus a stop/target planner, broker footprints, and financial health.",
      },
      vis: (
        <div className="flex flex-wrap gap-1.5">
          <Reason k="volatility_20" pctl={0.2} helps />
          <Reason k="ff_intensity_20" pctl={0.2} helps={false} />
        </div>
      ),
    },
  ];
  return (
    <section className="mb-14">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full cursor-pointer items-center justify-between gap-3 border-b border-line pb-3 text-left">
        <h2 className="text-lg font-semibold tracking-tight">
          <T id="Cara membaca Arus" en="How to read Arus" />
        </h2>
        <span className="flex items-center gap-1 text-[13px] text-muted">
          {open ? <T id="Sembunyikan" en="Hide" /> : <T id="Tampilkan" en="Show" />}
          <ChevronDown size={15} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }} className="overflow-hidden">
            <ol className="grid gap-8 pt-6 md:grid-cols-3 md:gap-10">
              {steps.map((s, i) => (
                <li key={i} className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-arus/15 text-[13px] font-semibold text-arus">{i + 1}</span>
                    <h3 className="text-[15px] font-semibold">{tx(s.t)}</h3>
                  </div>
                  <p className="text-[14px] leading-relaxed text-ink-2">{tx(s.d)}</p>
                  <div className="mt-auto pt-1">{s.vis}</div>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-[13px] text-muted">
              <Term k="scale">
                <T id="Kenapa skornya cuma di kisaran 40–60?" en="Why do scores only range 40–60?" />
              </Term>
              {" · "}
              <Link href="/metodologi/#ai" className="underline decoration-line-strong underline-offset-4 hover:text-ink-2">
                <T id="Kenapa disebut AI yang jujur?" en="Why call it honest AI?" />
              </Link>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ------------------------------------------------------------------ market today */
function MarketToday({ ranking, market, horizon, model }: { ranking: Stock[]; market: Bundle["market"]; horizon: Horizon; model: Bundle["models"]["1"] }) {
  const { tx } = useLang();
  const [mode, setMode] = useState<"score" | "move">("score");
  const [showMap, setShowMap] = useState(false);
  const ih = market.filter((m) => m.ihsg != null);
  const last = ih.at(-1)?.ihsg ?? 0;
  const ch1 = ih.length > 1 ? last / (ih.at(-2)!.ihsg as number) - 1 : 0;
  const ch20 = ih.length > 21 ? last / (ih.at(-21)!.ihsg as number) - 1 : 0;
  const ff20 = market.slice(-20).reduce((a, m) => a + (m.foreign_net ?? 0), 0);
  const up = ranking.filter((s) => (s.ret_1 ?? 0) > 0).length;
  const down = ranking.filter((s) => (s.ret_1 ?? 0) < 0).length;
  const top = [...model.coefficients].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, 2);
  const pattern = top.map((c) => tx(c.weight >= 0 ? FEATURE[c.feature as FeatureKey].hi : FEATURE[c.feature as FeatureKey].lo).toLowerCase());
  const pct1 = (x: number) => Math.abs(x * 100).toFixed(1);

  const cards: { icon: React.ReactNode; tone: "pos" | "neg" | "neu"; status: string; line: string; note: string }[] = [
    {
      icon: ch20 >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />,
      tone: ch20 > 0.03 ? "pos" : ch20 < -0.03 ? "neg" : "neu",
      status: ch20 > 0.03 ? tx({ id: "Pasar bergairah", en: "Market strong" }) : ch20 < -0.03 ? tx({ id: "Pasar lesu", en: "Market weak" }) : tx({ id: "Pasar datar", en: "Market flat" }),
      line: tx({ id: `IHSG ${ch20 >= 0 ? "naik" : "turun"} ${pct1(ch20).replace(".", ",")}% dalam sebulan`, en: `IHSG ${ch20 >= 0 ? "up" : "down"} ${pct1(ch20)}% over a month` }),
      note: tx({ id: `Hari ini ${signed(ch1 * 100, 1, "%")}, di level ${price(last, "id")}`, en: `Today ${signed(ch1 * 100, 1, "%")}, at ${price(last, "en")}` }),
    },
    {
      icon: <Globe size={18} />,
      tone: ff20 >= 0 ? "pos" : "neg",
      status: ff20 >= 0 ? tx({ id: "Asing masuk", en: "Foreigners buying" }) : tx({ id: "Asing keluar", en: "Foreigners selling" }),
      line: tx({ id: `Investor asing ${ff20 >= 0 ? "membeli" : "menjual"} ${idr(Math.abs(ff20), "id")} dalam sebulan`, en: `Foreign investors net ${ff20 >= 0 ? "bought" : "sold"} ${idr(Math.abs(ff20), "en")} over a month` }),
      note: tx({ id: "Arah dana asing sering diikuti pasar", en: "The market often follows foreign money" }),
    },
    {
      icon: <BarChart3 size={18} />,
      tone: up > down ? "pos" : up < down ? "neg" : "neu",
      status: up > down ? tx({ id: "Lebih banyak yang naik", en: "More stocks rising" }) : up < down ? tx({ id: "Lebih banyak yang turun", en: "More stocks falling" }) : tx({ id: "Seimbang", en: "Balanced" }),
      line: tx({ id: `${up} saham naik, ${down} turun hari ini`, en: `${up} stocks up, ${down} down today` }),
      note: tx({ id: `Dari ${ranking.length} saham yang dipantau Arus`, en: `Out of the ${ranking.length} stocks Arus tracks` }),
    },
    {
      icon: <Sparkles size={18} />,
      tone: "neu",
      status: tx({ id: "Yang sedang menang", en: "What's winning" }),
      line: tx({ id: "Saham yang ", en: "Stocks with " }) + pattern.join(tx({ id: " dan ", en: " and " })),
      note: tx({ id: "Pola yang paling sering unggul belakangan ini. Arus menyesuaikannya setiap hari.", en: "The pattern winning most often lately. Arus updates it every day." }),
    },
  ];
  const toneBg = { pos: "text-[#9cc5f5] bg-up/10", neg: "text-[#f0a3a3] bg-down/10", neu: "text-arus bg-arus/10" };
  const toneText = { pos: "text-[#9cc5f5]", neg: "text-[#f0a3a3]", neu: "text-arus" };

  return (
    <section className="mb-16">
      <h2 className="text-2xl font-semibold tracking-tight">
        <T id="Kondisi pasar hari ini" en="The market today" />
      </h2>
      <p className="mt-1.5 text-[14px] text-muted">
        <T id="Empat hal yang perlu Anda tahu sebelum memilih saham." en="Four things to know before picking stocks." />
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.05, ease: EASE }}
            className="flex flex-col rounded-2xl bg-surface p-5 ring-1 ring-line"
          >
            <div className="flex items-center gap-2.5">
              <span className={`grid h-8 w-8 place-items-center rounded-lg ${toneBg[c.tone]}`}>{c.icon}</span>
              <span className={`text-[13px] font-semibold ${toneText[c.tone]}`}>{c.status}</span>
            </div>
            <p className="mt-4 text-[17px] font-medium leading-snug text-ink">{c.line}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{c.note}</p>
          </motion.div>
        ))}
      </div>

      <button
        onClick={() => setShowMap((v) => !v)}
        aria-expanded={showMap}
        className="mt-5 flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-[13.5px] text-ink-2 ring-1 ring-line hover:bg-surface hover:text-ink"
      >
        <LayoutGrid size={15} className="shrink-0" />
        {showMap ? <T id="Sembunyikan peta pasar" en="Hide market map" /> : <T id="Tampilkan peta pasar: semua saham dalam satu layar" en="Show market map: every stock on one screen" />}
        <ChevronDown size={14} className={`shrink-0 transition-transform duration-200 ${showMap ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {showMap && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
            <div className="pt-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-[60ch] text-[13px] leading-relaxed text-muted">
                  <T id="Setiap kotak satu saham, dikelompokkan per sektor. Makin besar kotaknya, makin besar perusahaannya." en="Each tile is one stock, grouped by sector. The bigger the tile, the bigger the company." />{" "}
                  {mode === "score" ? <T id="Warna menunjukkan penilaian Arus." en="Colour shows the Arus verdict." /> : <T id="Warna menunjukkan naik-turun harga hari ini." en="Colour shows today's price move." />}
                </p>
                <Segmented
                  label={tx({ id: "Warna peta", en: "Map colour" })}
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "score", label: tx({ id: "Penilaian Arus", en: "Arus verdict" }) },
                    { value: "move", label: tx({ id: "Gerak hari ini", en: "Today's move" }) },
                  ]}
                />
              </div>
              <div className="hidden sm:block">
                <MarketMap stocks={ranking} horizon={horizon} mode={mode} height={480} />
              </div>
              <div className="sm:hidden">
                <MarketMap stocks={ranking} horizon={horizon} mode={mode} height={560} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-muted">
                {mode === "score" ? (
                  VERDICT_ORDER.map((k) => (
                    <span key={k} className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: VERDICT[k].color }} />
                      {tx(VERDICT[k].label)}
                    </span>
                  ))
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-down" />
                      {tx({ id: "Turun", en: "Down" })}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-raised" />
                      {tx({ id: "Datar", en: "Flat" })}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm bg-up" />
                      {tx({ id: "Naik", en: "Up" })}
                    </span>
                  </>
                )}
                <span>· {tx({ id: "Klik kotak untuk membuka saham", en: "Click a tile to open the stock" })}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ------------------------------------------------------------------ highlights */
type Scored = { s: Stock; g: ReturnType<typeof get>; v: VerdictKey };

function Highlights({ scored }: { scored: Scored[] }) {
  const { tx } = useLang();
  const unusual = (x: Stock) => Math.max(Math.abs(x.z_foreign ?? 0), Math.abs(x.z_volume ?? 0));
  const why = (x: Stock): Bi => {
    const zf = x.z_foreign ?? 0;
    const zv = x.z_volume ?? 0;
    if (Math.abs(zf) >= Math.abs(zv)) return zf > 0 ? { id: "asing borong", en: "heavy foreign buying" } : { id: "asing jual besar", en: "heavy foreign selling" };
    return zv > 0 ? { id: "volume melonjak", en: "volume spike" } : { id: "volume sepi", en: "volume dried up" };
  };
  const health = (x: Stock) => (x.fin_score != null && x.fin_n ? x.fin_score / x.fin_n + (x.rev_cagr ?? 0) * 0.1 : -1);
  const cols: { title: Bi; note: Bi; href?: string; rows: { s: Stock; value: React.ReactNode; tone?: string }[] }[] = [
    {
      title: { id: "Skor besok tertinggi", en: "Top next-day scores" },
      note: { id: "Untuk trader harian", en: "For day traders" },
      rows: scored.slice(0, 5).map(({ s, v }) => ({ s, value: tx(VERDICT[v].short), tone: "text-arus" })),
    },
    {
      title: { id: "Keuangan paling sehat", en: "Healthiest financials" },
      note: { id: "Untuk investor jangka panjang", en: "For long-term investors" },
      rows: [...scored.map((x) => x.s)]
        .sort((a, b) => health(b) - health(a))
        .slice(0, 5)
        .map((x) => ({ s: x, value: `${x.fin_score}/${x.fin_n}`, tone: "text-[#7fd4a8]" })),
    },
    {
      title: { id: "Paling tidak biasa hari ini", en: "Most unusual today" },
      note: { id: "Aktivitas jauh dari kebiasaannya", en: "Activity far from its norm" },
      href: "/anomali/",
      rows: [...scored.map((x) => x.s)]
        .sort((a, b) => unusual(b) - unusual(a))
        .slice(0, 5)
        .map((x) => ({ s: x, value: tx(why(x)), tone: (x.z_foreign ?? 0) >= 0 && Math.abs(x.z_foreign ?? 0) >= Math.abs(x.z_volume ?? 0) ? "text-[#9cc5f5]" : "text-ink-2" })),
    },
  ];
  return (
    <section className="mb-16">
      <h2 className="text-2xl font-semibold tracking-tight">
        <T id="Sorotan hari ini" en="Today's highlights" />
      </h2>
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {cols.map((col, ci) => (
          <motion.div
            key={col.title.en}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: ci * 0.06, ease: EASE }}
            className="min-w-0 rounded-2xl bg-surface p-5 ring-1 ring-line"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[15px] font-semibold">{tx(col.title)}</h3>
              {col.href && (
                <Link href={col.href} className="text-[12px] text-muted hover:text-arus">
                  {tx({ id: "Lihat semua", en: "See all" })}
                </Link>
              )}
            </div>
            <p className="text-[12px] text-muted">{tx(col.note)}</p>
            <ol className="mt-3 divide-y divide-line">
              {col.rows.map(({ s, value, tone }, i) => (
                <li key={s.symbol}>
                  <Link href={`/saham/${s.symbol}/`} className="group flex items-center gap-3 py-2.5">
                    <span className="num w-4 text-[12px] text-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-semibold text-ink group-hover:text-arus">{s.symbol}</span>
                      <span className="block truncate text-[12px] text-muted">{s.name}</span>
                    </span>
                    <span className={`num shrink-0 text-right text-[14px] font-semibold ${tone ?? "text-ink"}`}>{value}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ screener */
type Filters = {
  q: string;
  tab: "all" | "watch" | "sharia";
  verdicts: VerdictKey[];
  price: "all" | "lt1k" | "1k5k" | "gt5k";
  cap: "all" | "big" | "mid" | "small";
  liq: number;
  sector: string;
  foreignBuy: boolean;
  hideSusp: boolean;
  health: "all" | "strong" | "fairUp";
};
const DEFAULTS: Filters = { q: "", tab: "all", verdicts: [], price: "all", cap: "all", liq: 1e9, sector: "all", foreignBuy: false, hideSusp: false, health: "all" };
const LIQ = [1e9, 5e9, 1e10, 5e10, 1e11];
type SortKey = "score" | "health" | "move" | "foreign" | "price";

function Screener({ scored }: { scored: Scored[] }) {
  const { tx, lang } = useLang();
  const { watchlist } = usePrefs();
  const [f, setF] = useState<Filters>(DEFAULTS);
  const [more, setMore] = useState(false);
  const [sort, setSort] = useState<SortKey>("score");
  const [page, setPage] = useState(0);
  const PER = 20;
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setPage(0);
  };
  const sectors = useMemo(() => Array.from(new Set(scored.map((x) => x.s.sector).filter(Boolean))).sort() as string[], [scored]);
  const secName = (s: string) => (lang === "id" ? SECTOR_ID[s] ?? s : s);

  const rows = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const r = scored.filter(({ s, v }) => {
      if (f.tab === "watch" && !watchlist.includes(s.symbol)) return false;
      if (f.tab === "sharia" && !s.sharia) return false;
      if (q && !s.symbol.toLowerCase().includes(q) && !(s.name ?? "").toLowerCase().includes(q)) return false;
      if (f.verdicts.length && !f.verdicts.includes(v)) return false;
      const p = s.price ?? 0;
      if (f.price === "lt1k" && p >= 1000) return false;
      if (f.price === "1k5k" && (p < 1000 || p > 5000)) return false;
      if (f.price === "gt5k" && p <= 5000) return false;
      const mc = s.market_cap ?? 0;
      if (f.cap === "big" && mc <= 1e14) return false;
      if (f.cap === "mid" && (mc < 1e13 || mc > 1e14)) return false;
      if (f.cap === "small" && mc >= 1e13) return false;
      if ((s.turnover_med_20 ?? 0) < f.liq) return false;
      if (f.sector !== "all" && s.sector !== f.sector) return false;
      if (f.foreignBuy && !((s.ff_net_20 ?? 0) > 0)) return false;
      if (f.hideSusp && (s.suspended_recent || riskFlags(s.risk_flags).length)) return false;
      if (f.health === "strong" && s.fin_grade !== "strong") return false;
      if (f.health === "fairUp" && !(s.fin_grade === "strong" || s.fin_grade === "fair")) return false;
      return true;
    });
    const key = (x: Scored) =>
      sort === "score" ? x.g.conf : sort === "health" ? (x.s.fin_n ? (x.s.fin_score ?? 0) / x.s.fin_n : -1) : sort === "move" ? x.s.ret_1 ?? 0 : sort === "foreign" ? x.s.ff_net_20 ?? 0 : x.s.price ?? 0;
    return [...r].sort((a, b) => key(b) - key(a));
  }, [scored, f, sort, watchlist]);

  const activeCount = (["verdicts", "price", "cap", "liq", "sector", "foreignBuy", "hideSusp", "health"] as (keyof Filters)[]).filter((k) =>
    Array.isArray(f[k]) ? (f[k] as unknown[]).length > 0 : f[k] !== DEFAULTS[k],
  ).length;

  return (
    <section id="semua" className="scroll-mt-32">
      <h2 className="text-2xl font-semibold tracking-tight">
        <T id="Semua saham" en="All stocks" />
      </h2>
      <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-muted">
        <T
          id="Saring sesuai gaya Anda. Filter hanya mengatur apa yang tampil; skor setiap saham tidak berubah."
          en="Filter to your style. Filters only change what you see; each stock's score never changes."
        />
      </p>

      <div className="sticky top-[94px] z-30 -mx-4 mt-5 lg:top-14 border-y border-line bg-ground/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label={tx({ id: "Daftar", en: "List" })}
            value={f.tab}
            onChange={(v) => set("tab", v)}
            options={[
              { value: "all", label: tx({ id: "Semua", en: "All" }) },
              { value: "watch", label: `★ ${tx({ id: "Pantauanku", en: "My watchlist" })}${watchlist.length ? ` (${watchlist.length})` : ""}` },
              { value: "sharia", label: tx({ id: "Syariah", en: "Sharia" }) },
            ]}
          />
          <label className="flex h-9 min-w-40 flex-1 items-center gap-2 rounded-lg bg-surface px-3 ring-1 ring-line focus-within:ring-arus/60 sm:max-w-64">
            <Search size={14} className="text-muted" />
            <input value={f.q} onChange={(e) => set("q", e.target.value)} placeholder={tx({ id: "Cari", en: "Search" })} className="w-full bg-transparent text-[13px] text-ink placeholder:text-muted focus:outline-none" />
          </label>
          <button
            onClick={() => setMore((s) => !s)}
            aria-expanded={more}
            className="flex h-9 cursor-pointer items-center gap-2 rounded-lg px-3 text-[13px] text-ink-2 ring-1 ring-line hover:bg-surface hover:text-ink"
          >
            <SlidersHorizontal size={14} />
            <T id="Filter" en="Filters" />
            {activeCount > 0 && <span className="num rounded bg-arus px-1.5 text-[11px] font-semibold text-ground">{activeCount}</span>}
          </button>
          <label className="ml-auto flex items-center gap-2 text-[12.5px] text-muted">
            <span className="hidden sm:inline">
              <T id="Urutkan" en="Sort" />
            </span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-9 cursor-pointer rounded-lg bg-surface px-2 text-[13px] text-ink ring-1 ring-line focus:outline-none">
              <option value="score">{tx({ id: "Skor besok tertinggi", en: "Highest next-day score" })}</option>
              <option value="health">{tx({ id: "Keuangan paling sehat", en: "Healthiest financials" })}</option>
              <option value="move">{tx({ id: "Naik terbanyak hari ini", en: "Top gainers today" })}</option>
              <option value="foreign">{tx({ id: "Paling dibeli asing", en: "Most foreign-bought" })}</option>
              <option value="price">{tx({ id: "Harga tertinggi", en: "Highest price" })}</option>
            </select>
          </label>
        </div>

        <AnimatePresence initial={false}>
          {more && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: EASE }} className="overflow-hidden">
              <div className="grid gap-x-8 gap-y-5 pb-1 pt-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label={tx({ id: "Penilaian besok", en: "Next-day verdict" })} help={<Term k="verdict"><T id="Apa artinya?" en="What does it mean?" /></Term>}>
                  <div className="flex flex-wrap gap-1.5">
                    {VERDICT_ORDER.map((k) => {
                      const on = f.verdicts.includes(k);
                      return (
                        <button
                          key={k}
                          onClick={() => set("verdicts", on ? f.verdicts.filter((x) => x !== k) : [...f.verdicts, k])}
                          aria-pressed={on}
                          className={`cursor-pointer rounded-full px-2.5 py-1 text-[12px] ring-1 transition-colors duration-150 ${on ? `${VERDICT[k].bg} ${VERDICT[k].text} ${VERDICT[k].ring}` : "text-muted ring-line hover:text-ink-2"}`}
                        >
                          {tx(VERDICT[k].label)}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label={tx({ id: "Kesehatan keuangan", en: "Financial health" })}>
                  <Segmented
                    label="health"
                    value={f.health}
                    onChange={(v) => set("health", v)}
                    options={[
                      { value: "all", label: tx({ id: "Semua", en: "All" }) },
                      { value: "fairUp", label: tx({ id: "Cukup ke atas", en: "Fair or better" }) },
                      { value: "strong", label: tx({ id: "Sehat saja", en: "Healthy only" }) },
                    ]}
                  />
                </Field>
                <Field label={tx({ id: "Harga per lembar", en: "Price per share" })} help={tx({ id: "Harga murah bukan berarti saham murah.", en: "A low price doesn't mean a cheap stock." })}>
                  <Segmented
                    label="price"
                    value={f.price}
                    onChange={(v) => set("price", v)}
                    options={[
                      { value: "all", label: tx({ id: "Semua", en: "All" }) },
                      { value: "lt1k", label: "< 1.000" },
                      { value: "1k5k", label: "1.000–5.000" },
                      { value: "gt5k", label: "> 5.000" },
                    ]}
                  />
                </Field>
                <Field label={tx({ id: "Ukuran perusahaan", en: "Company size" })} help={tx({ id: "Besar > Rp100 T · Menengah Rp10–100 T · Kecil < Rp10 T", en: "Large > IDR 100T · Mid 10–100T · Small < 10T" })}>
                  <Segmented
                    label="cap"
                    value={f.cap}
                    onChange={(v) => set("cap", v)}
                    options={[
                      { value: "all", label: tx({ id: "Semua", en: "All" }) },
                      { value: "big", label: tx({ id: "Besar", en: "Large" }) },
                      { value: "mid", label: tx({ id: "Menengah", en: "Mid" }) },
                      { value: "small", label: tx({ id: "Kecil", en: "Small" }) },
                    ]}
                  />
                </Field>
                <Field label={tx({ id: "Sektor", en: "Sector" })}>
                  <select value={f.sector} onChange={(e) => set("sector", e.target.value)} className="h-9 w-full cursor-pointer rounded-lg bg-surface px-3 text-[13px] text-ink ring-1 ring-line focus:outline-none">
                    <option value="all">{tx({ id: "Semua sektor", en: "All sectors" })}</option>
                    {sectors.map((s) => (
                      <option key={s} value={s}>
                        {secName(s)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={
                    <>
                      <T id="Transaksi harian minimal" en="Minimum daily trading" /> · <span className="num text-ink">{idr(f.liq, lang)}</span>
                    </>
                  }
                  help={<Term k="liquidity"><T id="Ini batas bawah, bukan batas atas" en="This is a floor, not a cap" /></Term>}
                >
                  <input type="range" min={0} max={LIQ.length - 1} step={1} value={LIQ.indexOf(f.liq)} onChange={(e) => set("liq", LIQ[+e.target.value])} className="w-full accent-[#5cc8ff]" aria-label="liquidity" />
                  <div className="num flex justify-between text-[10.5px] text-muted">
                    {LIQ.map((l) => (
                      <span key={l}>{idr(l, lang)}</span>
                    ))}
                  </div>
                </Field>
                <div className="flex flex-col justify-end gap-1">
                  <Toggle checked={f.foreignBuy} onChange={(v) => set("foreignBuy", v)} label={tx({ id: "Hanya yang dibeli asing sebulan terakhir", en: "Only foreign-bought this month" })} />
                  <Toggle checked={f.hideSusp} onChange={(v) => set("hideSusp", v)} label={tx({ id: "Sembunyikan saham bertanda risiko", en: "Hide stocks with risk flags" })} />
                </div>
                {activeCount > 0 && (
                  <button onClick={() => setF({ ...DEFAULTS, tab: f.tab, q: f.q })} className="cursor-pointer justify-self-start text-[13px] text-arus hover:underline">
                    <T id="Hapus semua filter" en="Clear all filters" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {f.tab === "sharia" && (
        <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
          <Term k="sharia">
            <T id="Tentang tanda syariah" en="About the sharia flag" />
          </Term>
          {": "}
          <T id="ditandai dari indeks JII70, 70 saham syariah paling likuid." en="flagged from the JII70 index, the 70 most liquid sharia stocks." />
        </p>
      )}
      {f.tab === "watch" && watchlist.length === 0 && (
        <p className="py-14 text-center text-[14px] text-muted">
          <T id="Belum ada saham yang dipantau. Klik ikon ★ di samping saham mana pun untuk menambahkannya." en="Your watchlist is empty. Click the ★ next to any stock to add it." />
        </p>
      )}

      {/* desktop table */}
      <div className="mt-2 hidden md:block">
        <table className="w-full border-separate border-spacing-0 text-[13.5px]">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="w-10 py-2.5 font-normal" />
              <th className="w-[24%] py-2 pr-4 font-normal">
                <T id="Saham" en="Stock" />
              </th>
              <th className="py-2 pr-4 font-normal">
                <T id="Subsektor" en="Sub-sector" />
              </th>
              <th className="py-2 pr-4 text-right font-normal">
                <T id="Harga" en="Price" />
              </th>
              <th className="py-2 pr-4 text-right font-normal">
                <T id="Hari ini" en="Today" />
              </th>
              <th className="py-2 pr-4 text-right font-normal">
                <T id="1 bulan" en="1 month" />
              </th>
              <th className="py-2 pr-4 font-normal">
                <Term k="score">
                  <T id="Skor besok" en="Next-day score" />
                </Term>
              </th>
              <th className="py-2 pr-4 font-normal">
                <T id="Keuangan" en="Financials" />
              </th>
              <th className="py-2 pr-2 text-right font-normal">
                <T id="Asing 1 bln" en="Foreign 1 mo" />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(page * PER, page * PER + PER).map(({ s, g, v }) => {
              return (
                <tr key={s.symbol} className="group transition-colors duration-150 hover:bg-surface">
                  <td className="border-t border-line py-1.5">
                    <StarButton symbol={s.symbol} />
                  </td>
                  <td className="border-t border-line py-2 pr-4">
                    <Link href={`/saham/${s.symbol}/`} className="block">
                      <span className="flex items-center gap-2 font-semibold text-ink group-hover:text-arus">
                        {s.symbol}
                        {s.sharia && <Badge tone="good">{tx({ id: "Syariah", en: "Sharia" })}</Badge>}
                        <RiskBadge s={s} />
                      </span>
                      <span className="block max-w-60 truncate text-[11.5px] text-muted">{(s.name ?? "").replace(/^PT\.? /, "").replace(/ Tbk\.?$/, "")}</span>
                    </Link>
                  </td>
                  <td className="max-w-44 truncate border-t border-line py-2 pr-4 text-[12.5px] text-muted">{s.sub_sector ? (lang === "id" ? SUBSECTOR_ID[s.sub_sector] ?? s.sub_sector : s.sub_sector) : "–"}</td>
                  <td className="num border-t border-line py-2 pr-4 text-right text-ink-2">{price(s.price, lang)}</td>
                  <td className={`num border-t border-line py-2 pr-4 text-right ${(s.ret_1 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{signed((s.ret_1 ?? 0) * 100, 1, "%")}</td>
                  <td className={`num border-t border-line py-2 pr-4 text-right ${(s.ret_20 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{signed((s.ret_20 ?? 0) * 100, 1, "%")}</td>
                  <td className="border-t border-line py-2 pr-4">
                    <div className="flex items-center gap-2.5">
                      <span className="num w-7 text-[15px] font-semibold" style={{ color: VERDICT[v].color }}>{Math.round(g.conf * 100)}</span>
                      <span className="text-[12px] text-muted">{tx(VERDICT[v].label)}</span>
                    </div>
                  </td>
                  <td className="border-t border-line py-2 pr-4">
                    {s.fin_grade ? (
                      <span className={FIN_GRADE[s.fin_grade].tone}>
                        {tx(FIN_GRADE[s.fin_grade].label)} <span className="num text-[12px] text-muted">{s.fin_score}/{s.fin_n}</span>
                      </span>
                    ) : (
                      <span className="text-muted">–</span>
                    )}
                  </td>
                  <td className={`num border-t border-line py-2 pr-2 text-right ${(s.ff_net_20 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{idr(s.ff_net_20, lang)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* mobile cards */}
      <ul className="mt-2 divide-y divide-line md:hidden">
        {rows.slice(page * PER, page * PER + PER).map(({ s, g, v }) => {
          return (
            <li key={s.symbol} className="flex items-center gap-2 py-3">
              <StarButton symbol={s.symbol} />
              <Link href={`/saham/${s.symbol}/`} className="flex min-w-0 flex-1 items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold">{s.symbol}</span>
                    <span className={`num text-xs ${(s.ret_1 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{signed((s.ret_1 ?? 0) * 100, 1, "%")}</span>
                    {s.sharia && <Badge tone="good">{tx({ id: "Syariah", en: "Sharia" })}</Badge>}
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-muted">
                    {s.name}
                    {s.fin_grade && <span className={`ml-1.5 ${FIN_GRADE[s.fin_grade].tone}`}>· {tx(FIN_GRADE[s.fin_grade].label)}</span>}
                  </div>
                </div>
                <div className="num text-right text-xl font-semibold" style={{ color: VERDICT[v].color }}>
                  {Math.round(g.conf * 100)}
                  <span className="block text-[10px] font-normal text-muted">/100</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {rows.length === 0 && f.tab !== "watch" && (
        <div className="py-16 text-center text-[14px] text-muted">
          <T id="Tidak ada saham yang cocok dengan filter ini." en="No stocks match these filters." />{" "}
          <button onClick={() => setF(DEFAULTS)} className="cursor-pointer text-arus underline">
            <T id="Hapus filter" en="Clear filters" />
          </button>
        </div>
      )}
      {rows.length > PER && (
        <Pager
          page={page}
          pages={Math.ceil(rows.length / PER)}
          total={rows.length}
          per={PER}
          onChange={(p) => {
            setPage(p);
            document.getElementById("semua")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      )}
    </section>
  );
}

function Field({ label, help, children }: { label: React.ReactNode; help?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[12.5px] text-ink-2">{label}</div>
      {children}
      {help && <div className="mt-1.5 text-[11.5px] text-muted">{help}</div>}
    </div>
  );
}

/** One warn badge per row: the flag itself, or "N risks" with the list on hover. */
function RiskBadge({ s }: { s: Stock }) {
  const { tx } = useLang();
  const flags = riskFlags(s.risk_flags);
  if (!flags.length) return s.suspended_recent ? <Badge tone="warn">{tx({ id: "Suspensi", en: "Suspended" })}</Badge> : null;
  return (
    <span title={flags.map((f) => tx(RISK[f].label)).join(" · ")}>
      <Badge tone="warn">{flags.length > 1 ? tx({ id: `${flags.length} risiko`, en: `${flags.length} risks` }) : tx(RISK[flags[0]].label)}</Badge>
    </span>
  );
}

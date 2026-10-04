"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { CandleChart, type Cone } from "@/components/charts/candles";
import { DivergingBars } from "@/components/charts/analytics";
import { BandarBars } from "@/components/charts/bandar";
import { BrokerBehaviour, NewsList } from "@/components/brokers";
import { BrokerSummaryView } from "@/components/broker-summary";
import { FinanceTab } from "@/components/finance";
import { Perspectives } from "@/components/perspectives";
import { Tabs } from "@/components/tabs";
import { TradeSim } from "@/components/trade-sim";
import { Term } from "@/components/term";
import { Badge, Reason, StarButton, VerdictBadge } from "@/components/ui";
import { SECTOR_ID, SUBSECTOR_ID } from "@/lib/features";
import { dateLabel, idr, pct, price, signed } from "@/lib/format";
import { T, useLang, type Bi } from "@/lib/i18n";
import { BROKER_VERDICT, reasonMeaning, risks } from "@/lib/narrative";
import type { Broker, BrokerProfile, BrokerSummary, Bundle, Candles, FeatureKey, FinGrade, FinHealth, Horizon, MacroKey, NewsItem, Stock } from "@/lib/types";
import { get, verdictOf } from "@/lib/verdict";

type BandarDaily = NonNullable<Bundle["bandar"]>[string];

type Props = {
  stock: Stock;
  candles: Candles | null;
  broker: Broker | null;
  bandar: BandarDaily | null;
  macro: Bundle["macro"];
  cal: Record<Horizon, { a: number; b: number }>;
  weights: Record<Horizon, Record<string, number>>;
  families: Record<string, FeatureKey[]>;
  total: number;
  peers: { symbol: string; name: string | null; fin_grade?: FinGrade | null; fin_score?: number | null; fin_n?: number | null; pct_value?: number | null; rev_cagr?: number | null }[];
  fin: FinHealth | null;
  asOf: string;
  profile: BrokerProfile | null;
  summary: Record<"1" | "5" | "all", BrokerSummary> | null;
  news: NewsItem[];
  ihsg: { date: string; v: number | null }[];
  cone?: Record<Horizon, Cone> | null;
  coneCoverage?: Bundle["coneCoverage"] | null;
};

type Tab = "ringkasan" | "simulasi" | "bandar" | "keuangan" | "berita" | "global" | "harian";
const EASE = [0.23, 1, 0.32, 1] as const;

const MACRO_INFO: Record<MacroKey, { name: Bi; unit: Bi; scale: number; up: Bi; down: Bi }> = {
  idr: { name: { id: "Rupiah", en: "Rupiah" }, unit: { id: "rupiah melemah 1%", en: "rupiah weakens 1%" }, scale: 0.01, up: { id: "melemah", en: "weakened" }, down: { id: "menguat", en: "strengthened" } },
  oil: { name: { id: "Minyak Brent", en: "Brent oil" }, unit: { id: "minyak naik 1%", en: "oil rises 1%" }, scale: 0.01, up: { id: "naik", en: "rose" }, down: { id: "turun", en: "fell" } },
  spx: { name: { id: "Saham AS (S&P 500)", en: "US stocks (S&P 500)" }, unit: { id: "S&P 500 naik 1%", en: "S&P 500 rises 1%" }, scale: 0.01, up: { id: "naik", en: "rose" }, down: { id: "turun", en: "fell" } },
  vix: { name: { id: "Rasa takut global (VIX)", en: "Global fear (VIX)" }, unit: { id: "VIX naik 1 poin", en: "VIX rises 1 point" }, scale: 1, up: { id: "naik", en: "rose" }, down: { id: "turun", en: "fell" } },
  usd: { name: { id: "Dolar AS", en: "US dollar" }, unit: { id: "dolar menguat 1%", en: "dollar strengthens 1%" }, scale: 0.01, up: { id: "menguat", en: "strengthened" }, down: { id: "melemah", en: "weakened" } },
  us10y: { name: { id: "Bunga AS 10 tahun", en: "US 10-year yield" }, unit: { id: "yield naik 0,1 poin", en: "yield rises 0.1 pt" }, scale: 0.1, up: { id: "naik", en: "rose" }, down: { id: "turun", en: "fell" } },
};

export function StockView({ stock: s, candles, broker, bandar, macro, weights, peers, ihsg, cone, coneCoverage, fin, asOf, total, profile, news, summary }: Props) {
  const { tx, lang } = useLang();
  const horizon: Horizon = 1;
  const [tab, setTab] = useState<Tab>("ringkasan");
  const g = get(s, horizon);
  const v = verdictOf(g.q);
  const pctl = (k: FeatureKey) => (s as unknown as Record<string, number | null>)[k];
  const sub = s.sub_sector ? (lang === "id" ? SUBSECTOR_ID[s.sub_sector] ?? s.sub_sector : s.sub_sector) : "";
  const sec = s.sector ? (lang === "id" ? SECTOR_ID[s.sector] ?? s.sector : s.sector) : "";

  const n = candles?.c.length ?? 0;
  const lastV = n ? candles!.v[n - 1] ?? 0 : 0;
  const avgV = n ? candles!.v.slice(-20).reduce<number>((a, b) => a + (b ?? 0), 0) / Math.min(20, n) : 0;
  const prevC = n > 1 ? candles!.c[n - 2] : null;
  const chgAbs = s.price != null && prevC != null ? s.price - prevC : null;
  const up = (s.ret_1 ?? 0) >= 0;

  const levels = [
    { value: s.resistance_20 ?? NaN, label: { id: "Batas atas 1 bln", en: "1-mo ceiling" }, color: "#aab5c7" },
    { value: s.support_20 ?? NaN, label: { id: "Batas bawah 1 bln", en: "1-mo floor" }, color: "#aab5c7" },
    { value: s.invalidate ?? NaN, label: { id: "Sinyal batal", en: "Signal void" }, color: "#e66767" },
  ];

  const tabs: { value: Tab; label: string }[] = [
    { value: "ringkasan", label: tx({ id: "Ringkasan", en: "Summary" }) },
    { value: "simulasi", label: tx({ id: "Rencana trade", en: "Trade plan" }) },
    ...(summary || bandar || broker ? [{ value: "bandar" as Tab, label: tx({ id: "Bandar", en: "Brokers" }) }] : []),
    { value: "keuangan", label: tx({ id: "Keuangan", en: "Financials" }) },
    ...(news.length ? [{ value: "berita" as Tab, label: tx({ id: `Berita (${news.length})`, en: `News (${news.length})` }) }] : []),
    { value: "global", label: tx({ id: "Pengaruh global", en: "Global influence" }) },
    { value: "harian", label: tx({ id: "Data harian", en: "Daily data" }) },
  ];

  return (
    <div className="pt-6 sm:pt-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} />
        <T id="Semua saham" en="All stocks" />
      </Link>

      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} className="mt-4 rounded-2xl bg-surface p-5 ring-1 ring-line sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{s.symbol}</h1>
              <StarButton symbol={s.symbol} size={18} />
            </div>
            <p className="mt-0.5 text-[14px] text-ink-2">{s.name}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <VerdictBadge v={v} />
              {sec && <Badge>{sec}</Badge>}
              {sub && <Badge>{sub}</Badge>}
              {s.sharia && (
                <Term k="sharia">
                  <Badge tone="good">{tx({ id: "Syariah", en: "Sharia" })}</Badge>
                </Term>
              )}
              {s.suspended_recent && <Badge tone="warn">{tx({ id: "Pernah disuspensi 90h", en: "Suspended within 90d" })}</Badge>}
            </div>
          </div>
          <div className="text-right">
            <div className="num text-3xl font-semibold sm:text-4xl">{price(s.price, lang)}</div>
            <div className={`num mt-0.5 inline-flex items-center gap-1 text-[14px] ${up ? "text-up" : "text-down"}`}>
              {up ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
              {chgAbs != null ? `${chgAbs >= 0 ? "+" : ""}${price(chgAbs, lang)}` : ""} ({signed((s.ret_1 ?? 0) * 100, 2, "%")})
            </div>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 sm:grid-cols-5">
          {(
            [
              [{ id: "Volume", en: "Volume" }, `${(lastV / 1e6).toFixed(1)} jt`, ""],
              [{ id: "Rata-rata volume 20h", en: "Avg volume 20d" }, `${(avgV / 1e6).toFixed(1)} jt`, ""],
              [{ id: "Nilai transaksi", en: "Traded value" }, idr(s.price && lastV ? s.price * lastV : null, lang), ""],
              [{ id: "Kapitalisasi", en: "Market cap" }, idr(s.market_cap, lang), ""],
              [{ id: "1 bulan", en: "1 month" }, signed((s.ret_20 ?? 0) * 100, 1, "%"), (s.ret_20 ?? 0) >= 0 ? "text-up" : "text-down"],
            ] as [Bi, string, string][]
          ).map(([l, val, tone], i) => (
            <div key={i}>
              <dt className="text-[11.5px] text-muted">{tx(l)}</dt>
              <dd className={`num text-[15px] ${tone || "text-ink"}`}>{val}</dd>
            </div>
          ))}
        </dl>
      </motion.header>

      <Perspectives s={s} candles={candles} cone={cone ?? null} fin={fin} total={total} />

      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.1 }} className="mt-6 min-w-0 rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5">
        {candles ? <CandleChart data={candles} levels={levels} ihsg={ihsg} horizon={horizon} cone={cone?.[20]} height={480} /> : null}
        {coneCoverage?.["20"] && (
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
            <T
              id="Area biru di kanan grafik: rentang harga wajar sebulan ke depan. Dari data lalu, 8 dari 10 kali harga berakhir di dalam area ini. Area ini tidak menebak arah."
              en="The blue area on the right: the typical price range over the next month. In past data, 8 times in 10 the price ended inside it. It doesn't call a direction."
            />
          </p>
        )}
      </motion.section>

      <div className="mt-10">
        <Tabs label={tx({ id: "Bagian halaman", en: "Page sections" })} value={tab} onChange={setTab} items={tabs} />
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ duration: 0.25, ease: EASE }} className="pt-7">
            {tab === "ringkasan" && (
              <div className="space-y-10">
                <SummaryTab s={s} broker={broker} weights={weights[1]} pctl={pctl} asOf={asOf} />
                {summary && (
                  <div>
                    <BrokerSummaryView data={summary} last={s.price} compact />
                    <button onClick={() => setTab("bandar")} className="mt-2 cursor-pointer text-[13px] text-arus hover:underline">
                      {tx({ id: "Lihat detail bandar dan perilaku broker →", en: "See full broker detail and behaviour →" })}
                    </button>
                  </div>
                )}
              </div>
            )}
            {tab === "simulasi" && candles && <TradeSim candles={candles} />}
            {tab === "bandar" && (
              <div className="space-y-8">
                {summary && <BrokerSummaryView data={summary} last={s.price} />}
                <BandarTab s={s} bandar={bandar} broker={broker} />
                {profile && <BrokerBehaviour p={profile} last={s.price} />}
              </div>
            )}
            {tab === "berita" && (
              <div className="max-w-3xl">
                <NewsList items={news} />
                <p className="mt-4 text-[12px] text-muted">
                  <T id="Ringkasan berita dari Sectors (berbahasa Inggris), tautan menuju sumber aslinya." en="News summaries from Sectors, linking to the original source." />
                </p>
              </div>
            )}
            {tab === "keuangan" && <FinanceTab s={s} fin={fin} peers={peers} />}
            {tab === "global" && <GlobalTab s={s} macro={macro} />}
            {tab === "harian" && candles && <DailyTab candles={candles} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Tile({ label, value, note, tone }: { label: React.ReactNode; value: React.ReactNode; note?: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl bg-surface p-4 ring-1 ring-line">
      <div className="text-[12px] text-muted">{label}</div>
      <div className={`num mt-1 text-xl font-semibold ${tone ?? "text-ink"}`}>{value}</div>
      {note && <div className="num mt-0.5 text-[12px] text-muted">{note}</div>}
    </div>
  );
}

function SummaryTab({ s, broker, weights, pctl, asOf }: { s: Stock; broker: Broker | null; weights: Record<string, number>; pctl: (k: FeatureKey) => number | null; asOf: string }) {
  const { tx, lang } = useLang();
  const g = get(s, 1);
  const rel = (x: number | null) => (s.price && x ? signed((x / s.price - 1) * 100, 1, "%") : "");
  const reasons = [...g.pos.map((k) => ({ k, helps: true })), ...g.neg.map((k) => ({ k, helps: false }))]
    .sort((a, b) => Math.abs(g.contrib(b.k)) - Math.abs(g.contrib(a.k)))
    .slice(0, 4);
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="space-y-9">
        <section>
          <h3 className="text-[15px] font-semibold">
            <T id="Kenapa skor besoknya segini" en="Why tomorrow's score is what it is" />
          </h3>
          <p className="mt-1 text-[12.5px] text-muted">
            {tx({ id: `Berdasarkan data penutupan ${dateLabel(asOf, lang)}. Dihitung ulang setiap hari bursa.`, en: `Based on the ${dateLabel(asOf, lang)} close. Recalculated every trading day.` })}
          </p>
          <ul className="mt-4 space-y-3.5">
            {reasons.map(({ k, helps }) => (
              <li key={k}>
                <div className="min-w-0">
                  <Reason k={k} pctl={pctl(k)} helps={helps} />
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{tx(reasonMeaning(k, weights[k] ?? 0, pctl(k)))}</p>
                </div>
              </li>
            ))}
            {reasons.length === 0 && <li className="text-[13.5px] text-ink-2">{tx({ id: "Tidak ada sinyal yang menonjol hari ini.", en: "No signal stands out today." })}</li>}
          </ul>
        </section>

        <section>
          <h3 className="mb-3 text-[15px] font-semibold">
            <T id="Level harga penting" en="Key price levels" />
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label={<Term k="normalRange"><T id="Gerak normal harian" en="Normal daily move" /></Term>} value={`±${pct(s.atr_pct, 1)}`} note={`≈ Rp${price(s.atr_pct && s.price ? s.atr_pct * s.price : null, lang)}`} />
            <Tile label={<Term k="supportResistance"><T id="Batas bawah 1 bln" en="1-mo floor" /></Term>} value={price(s.support_20, lang)} note={rel(s.support_20)} />
            <Tile label={<Term k="supportResistance"><T id="Batas atas 1 bln" en="1-mo ceiling" /></Term>} value={price(s.resistance_20, lang)} note={rel(s.resistance_20)} />
            <Tile label={<Term k="invalidate"><T id="Batas sinyal batal" en="Signal void below" /></Term>} value={price(s.invalidate, lang)} note={rel(s.invalidate)} tone="text-[#f0a3a3]" />
          </div>
        </section>
      </div>

      <section>
        <h3 className="flex items-center gap-2 text-[15px] font-semibold">
          <ShieldAlert size={17} className="text-warn" />
          <T id="Perlu diperhatikan" en="Worth watching" />
        </h3>
        <ul className="mt-4 space-y-2.5 text-[13.5px] leading-relaxed text-ink-2">
          {risks(s, broker).map((r, i) => (
            <li key={i} className="flex gap-3 rounded-xl bg-surface p-3.5 ring-1 ring-line">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-warn" />
              {tx(r)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function BandarTab({ s, bandar, broker }: { s: Stock; bandar: BandarDaily | null; broker: Broker | null }) {
  const { tx, lang } = useLang();
  if (!bandar) {
    return broker ? (
      <div className="rounded-2xl bg-surface p-6 ring-1 ring-line">
        <div className="text-[12.5px] text-muted">
          <T id="Pola broker 20 hari terakhir" en="Broker pattern, last 20 days" />
        </div>
        <div className="mt-1 text-[18px] font-semibold text-ink">{tx(BROKER_VERDICT[broker.verdict] ?? { id: broker.verdict, en: broker.verdict })}</div>
      </div>
    ) : null;
  }
  const instTot = bandar.inst.reduce((a, b) => a + b, 0);
  const retailTot = bandar.retail.reduce((a, b) => a + b, 0);
  const forTot = bandar.foreign.reduce((a, b) => a + b, 0);
  const gap = bandar.bandar_avg && s.price ? s.price / bandar.bandar_avg - 1 : null;
  const streak = bandar.inst_streak;
  const maxBuy = Math.max(...bandar.top_buy.map((b) => Math.abs(b.net)), 1);
  const maxSell = Math.max(...bandar.top_sell.map((b) => Math.abs(b.net)), 1);
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label={<T id="Institusi berturut-turut" en="Institutional streak" />}
          value={streak === 0 ? "–" : `${Math.abs(streak)} ${tx({ id: "hari", en: "days" })}`}
          note={streak > 0 ? tx({ id: "membeli bersih", en: "net buying" }) : streak < 0 ? tx({ id: "menjual bersih", en: "net selling" }) : ""}
          tone={streak > 0 ? "text-up" : streak < 0 ? "text-down" : undefined}
        />
        <Tile
          label={<T id="Harga rata-rata bandar" en="Bandar average price" />}
          value={price(bandar.bandar_avg, lang)}
          note={gap != null ? (gap >= 0 ? tx({ id: `untung ${pct(gap, 1)} saat ini`, en: `in profit ${pct(gap, 1)}` }) : tx({ id: `rugi ${pct(-gap, 1)} saat ini`, en: `underwater ${pct(-gap, 1)}` })) : ""}
          tone={gap != null ? (gap >= 0 ? "text-up" : "text-down") : undefined}
        />
        <Tile label={<T id="Institusi (periode)" en="Institutions (period)" />} value={idr(instTot, lang)} tone={instTot >= 0 ? "text-up" : "text-down"} note={tx({ id: `${bandar.dates.length} hari bursa`, en: `${bandar.dates.length} sessions` })} />
        <Tile label={<T id="Ritel (periode)" en="Retail (period)" />} value={idr(retailTot, lang)} tone={retailTot >= 0 ? "text-up" : "text-down"} note={`${tx({ id: "Asing", en: "Foreign" })} ${idr(forTot, lang)}`} />
      </div>

      <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
        <h3 className="mb-1 text-[15px] font-semibold">
          <Term k="broker">
            <T id="Siapa membeli dan menjual setiap hari" en="Who bought and sold each day" />
          </Term>
        </h3>
        <p className="mb-4 text-[13px] text-muted">
          <T
            id="Pola yang perlu diwaspadai: biru (institusi) di bawah garis berhari-hari sementara oranye (ritel) di atas, artinya barang berpindah ke ritel."
            en="The pattern to watch: blue (institutions) below the line for days while orange (retail) sits above, meaning stock is moving to retail."
          />
        </p>
        <BandarBars dates={bandar.dates} inst={bandar.inst} retail={bandar.retail} foreign={bandar.foreign} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {[
          { title: { id: "Broker pengumpul terbesar", en: "Top accumulating brokers" }, list: bandar.top_buy, max: maxBuy, color: "#3987e5", buy: true },
          { title: { id: "Broker pelepas terbesar", en: "Top distributing brokers" }, list: bandar.top_sell, max: maxSell, color: "#e66767", buy: false },
        ].map((col) => (
          <div key={col.title.en} className="rounded-2xl bg-surface p-5 ring-1 ring-line">
            <h3 className="text-[15px] font-semibold">{tx(col.title)}</h3>
            <ul className="mt-4 space-y-3">
              {col.list.map((b) => (
                <li key={b.code}>
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span>
                      <span className="font-semibold text-ink">{b.code}</span>
                      <span className="ml-2 text-[11.5px] text-muted">
                        {b.cohort === "institutional" ? tx({ id: "institusi", en: "institutional" }) : b.cohort === "retail" ? tx({ id: "ritel", en: "retail" }) : b.cohort ?? ""}
                        {b.foreign ? ` · ${tx({ id: "asing", en: "foreign" })}` : ""}
                      </span>
                    </span>
                    <span className="num text-ink-2">
                      {idr(b.net, lang)}
                      {b.avg ? <span className="text-muted"> · @{price(b.avg, lang)}</span> : null}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-raised">
                    <motion.div className="h-1.5 rounded-full" style={{ background: col.color }} initial={{ width: 0 }} animate={{ width: `${(Math.abs(b.net) / col.max) * 100}%` }} transition={{ duration: 0.6, ease: EASE }} />
                  </div>
                  {col.buy && (
                    <div className="mt-0.5 text-[11px] text-muted">
                      {tx({ id: `beli bersih di ${b.days_buy} dari ${bandar.dates.length} hari`, en: `net buyer on ${b.days_buy} of ${bandar.dates.length} days` })}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-muted">
        <T
          id="Kelompok broker (institusi/ritel/asing) dari registri broker Sectors. Ditampilkan sebagai konteks; tidak memengaruhi skor karena riwayatnya terlalu pendek untuk diuji."
          en="Broker cohorts (institutional/retail/foreign) from the Sectors broker registry. Shown as context; not scored because the history is too short to test."
        />
      </p>
    </div>
  );
}

function GlobalTab({ s, macro }: { s: Stock; macro: Bundle["macro"] }) {
  const { tx, lang } = useLang();
  const keys: MacroKey[] = ["idr", "oil", "spx", "vix", "usd", "us10y"];
  const rows = keys
    .map((k) => {
      const beta = (s as unknown as Record<string, number | null>)[`beta_${k}`];
      return { k, impact: beta != null ? beta * MACRO_INFO[k].scale : null, d20: macro?.recent?.[k]?.d20 ?? null };
    })
    .filter((r) => r.impact != null) as { k: MacroKey; impact: number; d20: number | null }[];
  const push = rows.reduce((a, r) => a + r.impact * ((r.d20 ?? 0) / MACRO_INFO[r.k].scale), 0);
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div>
        <h3 className="text-[15px] font-semibold">
          <T id={`Seberapa sensitif ${s.symbol} terhadap dunia luar`} en={`How sensitive ${s.symbol} is to the outside world`} />
        </h3>
        <p className="mt-1 text-[13px] text-muted">
          <T id="Rata-rata gerak saham ini saat tiap faktor bergerak, dihitung dari 60 hari terakhir perilakunya sendiri." en="How this stock typically moves when each factor moves, from its own last 60 days." />
        </p>
        <div className="mt-4">
          <DivergingBars
            rowHeight={34}
            rows={rows.map((r) => ({ key: r.k, label: tx(MACRO_INFO[r.k].name), sub: tx({ id: `jika ${MACRO_INFO[r.k].unit.id}`, en: `if ${MACRO_INFO[r.k].unit.en}` }), value: r.impact }))}
            format={(v) => signed(v * 100, 2, "%")}
          />
        </div>
      </div>
      <div>
        <h3 className="text-[15px] font-semibold">
          <T id="Apa yang terjadi di luar sebulan terakhir" en="What happened outside in the last month" />
        </h3>
        <ul className="mt-4 space-y-2.5">
          {rows.map((r) => {
            const d = r.d20 ?? 0;
            const shown = r.k === "vix" ? `${Math.abs(d).toFixed(1)} ${tx({ id: "poin", en: "pts" })}` : r.k === "us10y" ? `${Math.abs(d).toFixed(2)} ${tx({ id: "poin", en: "pts" })}` : `${Math.abs(d * 100).toFixed(1).replace(".", lang === "id" ? "," : ".")}%`;
            return (
              <li key={r.k} className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2.5 text-[13.5px] ring-1 ring-line">
                <span className="text-ink-2">{tx(MACRO_INFO[r.k].name)}</span>
                <span className="num text-ink">
                  {tx(d >= 0 ? MACRO_INFO[r.k].up : MACRO_INFO[r.k].down)} {shown}
                </span>
              </li>
            );
          })}
        </ul>
        <div className={`mt-5 rounded-xl p-4 ring-1 ${push >= 0 ? "bg-up/10 ring-up/30" : "bg-down/10 ring-down/30"}`}>
          <div className="text-[12px] text-muted">
            <T id="Perkiraan dorongan global untuk saham ini" en="Estimated global push on this stock" />
          </div>
          <div className={`num mt-1 text-2xl font-semibold ${push >= 0 ? "text-up" : "text-down"}`}>{signed(push * 100, 1, "%")}</div>
          <div className="mt-1 text-[12px] text-muted">
            <T id="Sensitivitas × pergerakan faktor sebulan. Perkiraan kasar, bukan target harga." en="Sensitivity × one-month factor moves. A rough estimate, not a price target." />
          </div>
        </div>
        <p className="mt-4 text-[11.5px] text-muted">
          <T id="Sumber: FRED (Federal Reserve Bank of St. Louis) dan kurs referensi Bank Sentral Eropa." en="Sources: FRED (Federal Reserve Bank of St. Louis) and European Central Bank reference rates." />
        </p>
      </div>
    </div>
  );
}

function DailyTab({ candles }: { candles: Candles }) {
  const { tx, lang } = useLang();
  const [page, setPage] = useState(0);
  const PER = 15;
  const n = candles.c.length;
  const idx = Array.from({ length: n }, (_, i) => n - 1 - i);
  const pages = Math.ceil(n / PER);
  const rows = idx.slice(page * PER, page * PER + PER);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-right text-xs text-muted">
              <th className="py-2.5 pr-4 text-left font-normal">{tx({ id: "Tanggal", en: "Date" })}</th>
              <th className="py-2.5 pr-4 font-normal">{tx({ id: "Buka", en: "Open" })}</th>
              <th className="py-2.5 pr-4 font-normal">{tx({ id: "Tertinggi", en: "High" })}</th>
              <th className="py-2.5 pr-4 font-normal">{tx({ id: "Terendah", en: "Low" })}</th>
              <th className="py-2.5 pr-4 font-normal">{tx({ id: "Tutup", en: "Close" })}</th>
              <th className="py-2.5 pr-4 font-normal">%</th>
              <th className="py-2.5 pr-4 font-normal">Volume</th>
              <th className="py-2.5 pr-4 font-normal">{tx({ id: "Nilai", en: "Value" })}</th>
              <th className="py-2.5 pr-1 font-normal">{tx({ id: "Asing bersih", en: "Foreign net" })}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const c = candles.c[i];
              const pc = i > 0 ? candles.c[i - 1] : null;
              const ch = pc ? c / pc - 1 : null;
              const f = candles.f[i] ?? 0;
              const vol = candles.v[i] ?? 0;
              return (
                <tr key={candles.date[i]} className="num text-right hover:bg-surface">
                  <td className="border-t border-line py-2 pr-4 text-left text-ink-2">{dateLabel(candles.date[i], lang)}</td>
                  <td className="border-t border-line py-2 pr-4 text-ink-2">{price(candles.o[i], lang)}</td>
                  <td className="border-t border-line py-2 pr-4 text-ink-2">{price(candles.h[i], lang)}</td>
                  <td className="border-t border-line py-2 pr-4 text-ink-2">{price(candles.l[i], lang)}</td>
                  <td className="border-t border-line py-2 pr-4 text-ink">{price(c, lang)}</td>
                  <td className={`border-t border-line py-2 pr-4 ${ch == null ? "text-muted" : ch >= 0 ? "text-up" : "text-down"}`}>{ch == null ? "–" : signed(ch * 100, 2, "%")}</td>
                  <td className="border-t border-line py-2 pr-4 text-ink-2">{(vol / 1e6).toFixed(1)} jt</td>
                  <td className="border-t border-line py-2 pr-4 text-ink-2">{idr(c * vol, lang)}</td>
                  <td className={`border-t border-line py-2 pr-1 ${f >= 0 ? "text-up" : "text-down"}`}>{idr(f, lang)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-[13px] text-muted">
        <span>{tx({ id: `Halaman ${page + 1} dari ${pages}`, en: `Page ${page + 1} of ${pages}` })}</span>
        <div className="flex gap-2">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="cursor-pointer rounded-lg px-3 py-1.5 ring-1 ring-line hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40">
            {tx({ id: "Lebih baru", en: "Newer" })}
          </button>
          <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="cursor-pointer rounded-lg px-3 py-1.5 ring-1 ring-line hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40">
            {tx({ id: "Lebih lama", en: "Older" })}
          </button>
        </div>
      </div>
      <p className="mt-3 text-[12px] text-muted">
        <T id="Data harian final dari Sectors, diperbarui setiap hari bursa setelah penutupan. Data per menit tidak tersedia di Sectors." en="Final daily data from Sectors, updated after each close. Minute data isn't available from Sectors." />
      </p>
    </div>
  );
}

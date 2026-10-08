"use client";

import Link from "next/link";
import { NewsList } from "@/components/brokers";
import { Pager } from "@/components/pager";
import { Tabs } from "@/components/tabs";
import { cohortDot } from "@/components/broker-summary";
import { motion } from "motion/react";
import { AlertTriangle, ArrowUpRight, Search } from "lucide-react";
import { useState } from "react";
import { LineArea, SignedBars } from "@/components/charts/series";
import { ChartTitle } from "@/components/charts/kit";
import { Term } from "@/components/term";
import { VerdictBadge } from "@/components/ui";
import { idr } from "@/lib/format";
import { T, useLang } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import type { Bundle } from "@/lib/types";
import { get, verdictOf } from "@/lib/verdict";

const EASE = [0.23, 1, 0.32, 1] as const;

export function FlowsView({ market, brokers, ranking, bandar, summary, news }: Pick<Bundle, "market" | "brokers" | "ranking" | "bandar"> & { summary?: Bundle["brokerSummary"]; news?: Bundle["newsLatest"] }) {
  const { tx, lang } = useLang();
  const { horizon } = usePrefs();
  const rows = Object.entries(brokers)
    .map(([sym, b]) => ({ sym, b, s: ranking.find((r) => r.symbol === sym)! }))
    .filter((r) => r.s)
    .map((r) => ({ ...r, v: verdictOf(get(r.s, horizon).q), conf: get(r.s, horizon).conf }))
    .sort((a, b) => b.conf - a.conf);
  const positive = rows.filter((r) => r.v === "strong" || r.v === "edge");
  const conflictUp = positive.filter((r) => r.b.tone === "neg");
  const negative = rows.filter((r) => r.v === "caution" || r.v === "weak");
  const conflictDown = negative.filter((r) => r.b.tone === "pos");
  const byForeign = [...ranking].filter((r) => r.ff_net_20 != null).sort((a, b) => (b.ff_net_20 ?? 0) - (a.ff_net_20 ?? 0));
  const ff20 = market.slice(-20).reduce((a, m) => a + (m.foreign_net ?? 0), 0);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"asing" | "bandar" | "berita">("asing");
  const [page, setPage] = useState(0);
  const PER = 24;
  const [sortBy, setSortBy] = useState<"inst" | "retail" | "foreign">("inst");
  const sum = (xs: number[] | undefined) => (xs ?? []).reduce((a, b) => a + b, 0);
  const foot = ranking
    .filter((r) => bandar?.[r.symbol])
    .map((r) => {
      const b = bandar![r.symbol];
      const all = summary?.[r.symbol]?.all;
      const tilt = all && all.top5_buy + all.top5_sell > 0 ? (all.top5_buy - all.top5_sell) / (all.top5_buy + all.top5_sell) : 0;
      return { sym: r.symbol, name: r.name, inst: sum(b.inst), retail: sum(b.retail), foreign: sum(b.foreign), days: b.dates.length, tilt, top: all?.buyers[0] ?? null };
    })
    .filter((r) => !q.trim() || r.sym.toLowerCase().includes(q.trim().toLowerCase()) || (r.name ?? "").toLowerCase().includes(q.trim().toLowerCase()) || r.top?.code.toLowerCase() === q.trim().toLowerCase())
    .sort((a, b) => b[sortBy] - a[sortBy]);

  return (
    <div className="pt-7 sm:pt-9">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="max-w-3xl">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-balance sm:text-[2.4rem]">
          <T id="Siapa yang membeli, siapa yang menjual" en="Who is buying, who is selling" />
        </h1>
        <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-ink-2 sm:text-[15.5px]">
          <T
            id="Dua hal yang sering dipantau trader: ke mana uang investor asing mengalir, dan apakah yang membeli itu institusi besar atau investor ritel. Pola yang paling patut diwaspadai: institusi diam-diam menjual, sementara ritel justru membeli."
            en="Two things traders watch: where foreign money flows, and whether buyers are large institutions or retail. The pattern to watch most: institutions quietly selling while retail buys."
          />
        </p>
      </motion.header>

      <div className="mt-10">
        <Tabs
          label={tx({ id: "Bagian halaman", en: "Page sections" })}
          value={tab}
          onChange={setTab}
          items={[
            { value: "asing", label: tx({ id: "Dana asing", en: "Foreign money" }) },
            { value: "bandar", label: tx({ id: "Jejak bandar", en: "Broker footprint" }) },
            { value: "berita", label: tx({ id: `Berita${news?.length ? ` (${news.length})` : ""}`, en: `News${news?.length ? ` (${news.length})` : ""}` }) },
          ]}
        />
      </div>
      <div className="pt-8">
        {tab === "asing" && (
          <>
      <section>
        <p className="max-w-[70ch] text-[15px] leading-relaxed text-ink-2">
          <span className="font-medium text-ink">{ff20 >= 0 ? <T id="Asing sedang masuk." en="Foreigners are buying." /> : <T id="Asing sedang keluar." en="Foreigners are selling." />}</span>{" "}
          <T
            id={`Dalam sebulan terakhir investor asing ${ff20 >= 0 ? "membeli" : "menjual"} bersih ${idr(Math.abs(ff20), "id")} di seluruh bursa.`}
            en={`Over the past month foreign investors net ${ff20 >= 0 ? "bought" : "sold"} ${idr(Math.abs(ff20), "en")} across the exchange.`}
          />
        </p>
        <div className="mt-6 grid gap-10 lg:grid-cols-2">
          <div>
            <ChartTitle note={tx({ id: "Indeks harga saham gabungan, sepanjang histori Arus.", en: "The composite index over Arus' full history." })}>IHSG</ChartTitle>
            <LineArea data={market.map((m) => ({ date: m.date, v: m.ihsg }))} height={220} format="index" />
          </div>
          <div>
            <ChartTitle note={tx({ id: "Setiap batang satu hari. Biru = asing lebih banyak membeli, merah = lebih banyak menjual.", en: "Each bar is one day. Blue = foreigners bought more, red = sold more." })}>
              <Term k="foreignFlow">
                <T id="Dana asing harian, seluruh bursa" en="Daily foreign flow, whole exchange" />
              </Term>
            </ChartTitle>
            <SignedBars data={market.map((m) => ({ date: m.date, v: m.foreign_net }))} height={220} />
          </div>
        </div>
      </section>

      <section className="mt-16 grid gap-12 lg:grid-cols-2">
        {[
          { title: { id: "Paling banyak dibeli asing (1 bulan)", en: "Most bought by foreigners (1 month)" }, list: byForeign.slice(0, 8) },
          { title: { id: "Paling banyak dijual asing (1 bulan)", en: "Most sold by foreigners (1 month)" }, list: byForeign.slice(-8).reverse() },
        ].map((g) => (
          <div key={g.title.en}>
            <h2 className="text-lg font-semibold tracking-tight">{tx(g.title)}</h2>
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {g.list.map((r) => (
                <li key={r.symbol}>
                  <Link href={`/saham/${r.symbol}/`} className="flex items-center justify-between gap-3 py-2.5 text-[14px] hover:text-arus">
                    <span className="min-w-0 truncate">
                      <span className="font-semibold">{r.symbol}</span> <span className="hidden text-[12px] text-muted sm:inline">{r.name}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className={`num ${(r.ff_net_20 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{idr(r.ff_net_20, lang)}</span>
                      <VerdictBadge v={verdictOf(get(r, horizon).q)} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

          </>
        )}
        {tab === "bandar" && (
          <>
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">
          <Term k="broker">
            <T id="Jejak bandar" en="Broker footprint" />
          </Term>
        </h2>
        <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-muted">
          <T
            id="Untuk setiap saham: berapa yang dibeli bersih oleh broker institusi, broker ritel, dan investor asing selama periode data broker, serta siapa pembeli terbesarnya. Cari kode saham atau kode broker."
            en="For every stock: how much institutional brokers, retail brokers and foreign investors net bought over the broker-data window, and who the biggest buyer was. Search by stock or broker code."
          />
        </p>

        {(conflictUp.length > 0 || conflictDown.length > 0) && (
          <div className="mt-6 flex gap-3 rounded-2xl bg-warn/8 p-5 ring-1 ring-warn/30">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-warn" />
            <div className="text-[14.5px] leading-relaxed text-ink-2">
              <div className="font-semibold text-ink">
                <T id="Dua bukti saling bertentangan hari ini" en="Two kinds of evidence disagree today" />
              </div>
              {conflictUp.length > 0 && (
                <p className="mt-1.5">
                  <T
                    id={`${conflictUp.length} dari ${positive.length} saham yang dinilai Arus diunggulkan justru sedang ditinggal institusi: ${conflictUp.slice(0, 6).map((r) => r.sym).join(", ")}.`}
                    en={`${conflictUp.length} of ${positive.length} stocks Arus rates favourably are being exited by institutions: ${conflictUp.slice(0, 6).map((r) => r.sym).join(", ")}.`}
                  />
                </p>
              )}
              {conflictDown.length > 0 && (
                <p className="mt-1.5">
                  <T
                    id={`Sebaliknya, ${conflictDown.length} saham bertanda Waspada sedang dikumpulkan institusi: ${conflictDown.slice(0, 6).map((r) => r.sym).join(", ")}.`}
                    en={`Conversely, ${conflictDown.length} Caution-flagged stocks are being accumulated by institutions: ${conflictDown.slice(0, 6).map((r) => r.sym).join(", ")}.`}
                  />
                </p>
              )}
              <p className="mt-1.5 text-[13.5px] text-muted">
                <T
                  id="Skor Arus berasal dari pola yang diuji ke data historis; jejak bandar adalah kondisi hari ini yang belum bisa diuji. Saat keduanya bertentangan, keyakinan sebaiknya diturunkan dan ukuran posisi diperkecil."
                  en="The Arus score comes from patterns tested on historical data; the broker footprint is today's state and can't be tested. When they disagree, lower your conviction and size positions smaller."
                />
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="flex h-10 min-w-56 flex-1 items-center gap-2 rounded-lg bg-surface px-3 ring-1 ring-line focus-within:ring-arus/60 sm:max-w-80">
            <Search size={15} className="text-muted" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder={tx({ id: "Cari saham atau kode broker (mis. BBCA, YP)", en: "Search a stock or broker code (e.g. BBCA, YP)" })} className="w-full bg-transparent text-[13.5px] text-ink placeholder:text-muted focus:outline-none" />
          </label>
          <label className="flex items-center gap-2 text-[12.5px] text-muted">
            <T id="Urutkan" en="Sort" />
            <select value={sortBy} onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setPage(0); }} className="h-10 cursor-pointer rounded-lg bg-surface px-2 text-[13px] text-ink ring-1 ring-line focus:outline-none">
              <option value="inst">{tx({ id: "Paling diborong institusi", en: "Most bought by institutions" })}</option>
              <option value="retail">{tx({ id: "Paling diborong ritel", en: "Most bought by retail" })}</option>
              <option value="foreign">{tx({ id: "Paling diborong asing", en: "Most bought by foreigners" })}</option>
            </select>
          </label>
          <span className="text-[12.5px] text-muted">{tx({ id: `${foot.length} saham`, en: `${foot.length} stocks` })}</span>
        </div>

        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {foot.slice(page * PER, page * PER + PER).map((r) => {
            const tilt = r.tilt > 0.15 ? "up" : r.tilt < -0.15 ? "down" : "flat";
            return (
              <li key={r.sym}>
                <Link href={`/saham/${r.sym}/`} className="group block rounded-xl bg-surface px-4 py-3.5 ring-1 ring-line transition-colors duration-150 hover:ring-line-strong">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold text-ink group-hover:text-arus">{r.sym}</div>
                      <div className="truncate text-[12px] text-muted">{(r.name ?? "").replace(/^PT\.? /, "").replace(/ Tbk\.?$/, "")}</div>
                    </div>
                    <span className={`shrink-0 text-[12px] font-medium ${tilt === "up" ? "text-[#9cc5f5]" : tilt === "down" ? "text-[#f0a3a3]" : "text-muted"}`}>
                      {tilt === "up" ? tx({ id: "Akumulasi", en: "Accumulation" }) : tilt === "down" ? tx({ id: "Distribusi", en: "Distribution" }) : tx({ id: "Seimbang", en: "Balanced" })}
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between gap-3">
                    <span className="text-[12px] text-muted">{tx({ id: "Institusi bersih", en: "Institutions net" })}</span>
                    <span className={`num text-lg font-semibold ${r.inst >= 0 ? "text-up" : "text-down"}`}>{idr(r.inst, lang)}</span>
                  </div>
                  <div className="num mt-1 flex justify-between gap-3 text-[12px] text-muted">
                    <span>
                      {tx({ id: "Ritel", en: "Retail" })} <span className={r.retail >= 0 ? "text-up" : "text-down"}>{idr(r.retail, lang)}</span>
                    </span>
                    <span>
                      {tx({ id: "Asing", en: "Foreign" })} <span className={r.foreign >= 0 ? "text-up" : "text-down"}>{idr(r.foreign, lang)}</span>
                    </span>
                    {r.top && (
                      <span className="inline-flex items-center gap-1">
                        {cohortDot(r.top.cohort, r.top.foreign)}
                        <span className="text-ink-2">{r.top.code}</span>
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        {foot.length > PER && <Pager page={page} pages={Math.ceil(foot.length / PER)} total={foot.length} per={PER} onChange={setPage} />}
        {foot.length === 0 && (
          <p className="py-8 text-[14px] text-muted">
            <T id="Tidak ada yang cocok." en="Nothing matches." />
          </p>
        )}
      </section>

      <Link href="/broker/" className="group mt-10 flex items-center gap-4 rounded-2xl bg-arus/10 p-5 ring-1 ring-arus/40 transition-colors duration-150 hover:bg-arus/15">
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold text-ink">
            <T id="Direktori broker" en="Broker directory" />
          </span>
          <span className="block text-[13.5px] text-ink-2">
            <T id="Cari broker mana pun dan lihat di saham apa saja ia mengumpulkan atau melepas, beserta gaya belinya." en="Look up any broker and see which stocks it is accumulating or unloading, and how it buys." />
          </span>
        </span>
        <ArrowUpRight size={20} className="shrink-0 text-arus transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </Link>

          </>
        )}
        {tab === "berita" && (
      <section>
        {news && news.length > 0 ? (
          <NewsList items={news} searchable />
        ) : (
          <p className="py-10 text-[14px] text-muted">
            <T id="Belum ada berita." en="No news yet." />
          </p>
        )}
        <p className="mt-4 text-[12px] text-muted">
          <T id="Ringkasan berita dari Sectors (berbahasa Inggris), tautan menuju sumber aslinya." en="News summaries from Sectors, linking to the original source." />
        </p>
      </section>
        )}
      </div>
    </div>
  );
}

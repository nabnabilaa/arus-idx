"use client";

import { motion } from "motion/react";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AfterCard, ChainCard, FilingRow } from "@/components/insider";
import { chainCard, N_CHAIN_CARDS } from "@/lib/cards";
import { Pager } from "@/components/pager";
import { Segmented, Toggle } from "@/components/ui";
import { dateLabel, idr } from "@/lib/format";
import { T, useLang } from "@/lib/i18n";
import type { InsiderBook } from "@/lib/types";

const EASE = [0.23, 1, 0.32, 1] as const;
const PER = 25;
const PER_CHAIN = 9;

type Side = "all" | "buy" | "sell";
type Size = 0 | 1e9 | 1e10;

export function InsiderView({ book, ranked }: { book: InsiderBook; ranked: string[] }) {
  const { tx, lang } = useLang();
  const isRanked = useMemo(() => new Set(ranked), [ranked]);
  const [chainSide, setChainSideRaw] = useState<"buy" | "sell">("buy");
  const [chainPage, setChainPage] = useState(0);
  const [side, setSideRaw] = useState<Side>("all");
  const [size, setSizeRaw] = useState<Size>(0);
  const [marketOnly, setMarketOnlyRaw] = useState(true);
  const [q, setQRaw] = useState("");
  const [page, setPage] = useState(0);
  // any filter change starts the list again from page one
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(0);
  };
  const setSide = reset(setSideRaw);
  const setSize = reset(setSizeRaw);
  const setMarketOnly = reset(setMarketOnlyRaw);
  const setQ = reset(setQRaw);
  const setChainSide = (v: "buy" | "sell") => {
    setChainSideRaw(v);
    setChainPage(0);
  };
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const market = book.events.filter((e) => e.market && !e.twoway);
  const buyVal = market.filter((e) => e.side === "buy").reduce((a, e) => a + (e.val ?? 0), 0);
  const sellVal = market.filter((e) => e.side === "sell").reduce((a, e) => a + (e.val ?? 0), 0);
  const chains = book.chains.filter((c) => c.side === chainSide);

  const query = q.trim().toUpperCase();
  const rows = book.events.filter(
    (e) =>
      (side === "all" || e.side === side) &&
      (e.val ?? 0) >= size &&
      (!marketOnly || (e.market && !e.twoway)) &&
      (!query || e.s.includes(query) || e.holder.toUpperCase().includes(query)),
  );

  return (
    <div className="pt-7 sm:pt-9">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="max-w-3xl">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-balance sm:text-[2.4rem]">
          <T id="Apa yang dilakukan orang dalam dengan sahamnya sendiri" en="What insiders do with their own shares" />
        </h1>
        <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-ink-2 sm:text-[15.5px]">
          <T
            id="Direksi, komisaris, dan pemegang saham besar wajib melapor ke KSEI setiap kali membeli atau menjual. Arus membaca semua laporan itu: siapa yang terus menambah, di harga berapa, seberapa besar kepemilikannya sekarang, dan apa yang terjadi pada harga sesudahnya."
            en="Directors, commissioners and major shareholders must report to KSEI every time they buy or sell. Arus reads every filing: who keeps adding, at what price, how big their stake is now, and what the price did afterwards."
          />
        </p>
      </motion.header>

      <section className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [tx({ id: "Laporan 90 hari", en: "Filings, 90 days" }), book.window ? book.window.n.toLocaleString(lang === "id" ? "id-ID" : "en-US") : "–", "text-ink"],
          [tx({ id: "Nilai beli (pasar)", en: "Bought (market)" }), idr(buyVal, lang), "text-[#7fd4a8]"],
          [tx({ id: "Nilai jual (pasar)", en: "Sold (market)" }), idr(sellVal, lang), "text-[#f0a3a3]"],
          [tx({ id: "Rantai beli & jual", en: "Buy & sell chains" }), String(book.chains.length), "text-arus"],
        ].map(([l, v, t], i) => (
          <motion.div key={l} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.05, ease: EASE }} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
            <div className="text-[12px] text-muted">{l}</div>
            <div className={`num mt-1 text-2xl font-semibold ${t}`}>{v}</div>
          </motion.div>
        ))}
      </section>

      {/* chains */}
      <section id="rantai" className="mt-10 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              <T id="Rantai transaksi" en="Filing chains" />
            </h2>
            <p className="mt-1.5 max-w-[65ch] text-[13.5px] text-muted">
              <T id="Pemegang yang melapor berkali-kali di saham yang sama. Titik pada grafik: hari ia bertransaksi, besarnya sesuai jumlah saham." en="Holders who filed again and again in the same stock. Dots on the chart: the days they traded, sized by shares." />
            </p>
          </div>
          <Segmented<"buy" | "sell">
            label={tx({ id: "Arah", en: "Side" })}
            value={chainSide}
            onChange={setChainSide}
            options={[
              { value: "buy", label: tx({ id: `Beli (${book.chains.filter((c) => c.side === "buy").length})`, en: `Buy (${book.chains.filter((c) => c.side === "buy").length})` }) },
              { value: "sell", label: tx({ id: `Jual (${book.chains.filter((c) => c.side === "sell").length})`, en: `Sell (${book.chains.filter((c) => c.side === "sell").length})` }) },
            ]}
          />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {chains.slice(chainPage * PER_CHAIN, chainPage * PER_CHAIN + PER_CHAIN).map((c, i) => (
            <ChainCard key={`${c.s}-${c.holder}-${c.side}`} c={c} path={book.paths[c.s]} ranked={isRanked.has(c.s)} i={i} card={book.chains.indexOf(c) < N_CHAIN_CARDS ? chainCard(c) : null} />
          ))}
        </div>
        {chains.length > PER_CHAIN && (
          <Pager
            page={chainPage}
            pages={Math.ceil(chains.length / PER_CHAIN)}
            total={chains.length}
            per={PER_CHAIN}
            onChange={(p) => {
              setChainPage(p);
              jump("rantai");
            }}
            noun={{ id: "rantai", en: "chains" }}
          />
        )}
      </section>

      {/* what followed */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          <T id="Kalau orang dalam membeli, apakah sahamnya lalu unggul?" en="When insiders buy, does the stock then do better?" />
        </h2>
        <p className="mt-1.5 max-w-[75ch] text-[13.5px] leading-relaxed text-muted">
          <T
            id="Dari setiap laporan transaksi pasar 90 hari terakhir: seberapa sering saham itu mengalahkan saham rata-rata BEI, dihitung sejak hari pertama laporan bisa diperdagangkan. 50 berarti tidak ada bedanya."
            en="From every market-trade filing in the last 90 days: how often the stock beat the median IDX stock, counted from the first session the filing could be traded on. 50 means no difference."
          />
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <AfterCard i={0} a={book.after.buy} label={tx({ id: "Orang dalam membeli", en: "Insider buys" })} note={tx({ id: "Semua laporan beli.", en: "Every buy filing." })} />
          <AfterCard i={1} a={book.after.chain_buy} label={tx({ id: "Membeli berulang (3+ kali)", en: "Repeated buying (3+ times)" })} note={tx({ id: "Pemegang yang sama, saham yang sama.", en: "Same holder, same stock." })} />
          <AfterCard i={2} a={book.after.sell} label={tx({ id: "Orang dalam menjual", en: "Insider sells" })} note={tx({ id: "Semua laporan jual.", en: "Every sell filing." })} />
        </div>
        <p className="mt-3 max-w-[75ch] text-[13px] leading-relaxed text-ink-2">
          <T
            id="Temuan Arus: dalam 90 hari ini, pembelian orang dalam belum menjadi tanda saham akan unggul. Gunakan sebagai konteks (siapa yang yakin, di harga berapa), bukan sebagai sinyal beli."
            en="Arus' finding: over these 90 days, insider buying has not marked stocks that go on to do better. Use it as context (who is committed, at what price), not as a buy signal."
          />
        </p>
      </section>

      {/* every filing */}
      <section id="semua-laporan" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          <T id="Semua laporan" en="Every filing" /> · <span className="num text-ink-2">{rows.length}</span>
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="relative flex min-h-9 items-center">
            <Search size={14} className="pointer-events-none absolute left-2.5 text-muted" />
            <input
              value={q}
              onChange={(ev) => setQ(ev.target.value)}
              placeholder={tx({ id: "Kode saham atau nama", en: "Ticker or holder" })}
              aria-label={tx({ id: "Cari kode saham atau nama pemegang", en: "Search ticker or holder" })}
              className="h-9 w-52 rounded-lg bg-surface pl-8 pr-3 text-[13px] text-ink ring-1 ring-line placeholder:text-muted focus:ring-arus/60"
            />
          </label>
          <Segmented<Side>
            label={tx({ id: "Arah", en: "Side" })}
            value={side}
            onChange={setSide}
            options={[
              { value: "all", label: tx({ id: "Semua", en: "All" }) },
              { value: "buy", label: tx({ id: "Beli", en: "Buy" }) },
              { value: "sell", label: tx({ id: "Jual", en: "Sell" }) },
            ]}
          />
          <Segmented<Size>
            label={tx({ id: "Nilai minimal", en: "Minimum value" })}
            value={size}
            onChange={setSize}
            options={[
              { value: 0, label: tx({ id: "Semua nilai", en: "Any value" }) },
              { value: 1e9, label: "≥ " + idr(1e9, lang) },
              { value: 1e10, label: "≥ " + idr(1e10, lang) },
            ]}
          />
          <Toggle checked={marketOnly} onChange={setMarketOnly} label={tx({ id: "Hanya transaksi pasar", en: "Market trades only" })} />
        </div>
        <ul className="mt-4 flex flex-col gap-2">
          {rows.slice(page * PER, page * PER + PER).map((e, i) => (
            <FilingRow key={`${e.ts}-${e.s}-${e.holder}-${i}`} e={e} name={book.stocks[e.s]?.name} ranked={isRanked.has(e.s)} ksei={book.ksei} />
          ))}
        </ul>
        {rows.length > PER && (
          <Pager
            page={page}
            pages={Math.ceil(rows.length / PER)}
            total={rows.length}
            per={PER}
            onChange={(p) => {
              setPage(p);
              jump("semua-laporan");
            }}
            noun={{ id: "laporan", en: "filings" }}
          />
        )}
        {rows.length === 0 && (
          <p className="py-14 text-center text-[14px] text-muted">
            <T id="Tidak ada laporan yang cocok dengan saringan ini." en="No filing matches these filters." />
          </p>
        )}
      </section>

      <p className="mt-10 max-w-[75ch] text-[13px] leading-relaxed text-muted">
        {book.window && tx({ id: `Laporan ${dateLabel(book.window.from, "id")} – ${dateLabel(book.window.to, "id")} dari KSEI lewat Sectors. `, en: `Filings ${dateLabel(book.window.from, "en")} – ${dateLabel(book.window.to, "en")} from KSEI via Sectors. ` })}
        <T
          id="“Transaksi pasar” mengecualikan repo (gadai), private placement, opsi saham karyawan, restrukturisasi modal, ambil alih, pemenuhan free float, pengalihan blok (satu laporan yang memindahkan 5 poin persen atau lebih, atau jual-beli blok yang sama antarpemegang), pemegang yang melapor dua arah (biasanya perantara), dan laporan yang harganya tidak wajar dibanding harga pasar hari itu (kesalahan data sumber). Ini informasi, bukan nasihat keuangan."
          en="“Market trades” leave out repo pledges, private placements, employee options, capital restructurings, takeovers, free-float sales, block transfers (a single filing moving 5+ percentage points, or the same block sold by one holder and bought by another), holders filing both ways (usually intermediaries), and filings whose price is far from that day's market price (source errors). Information, not financial advice."
        />
      </p>
    </div>
  );
}

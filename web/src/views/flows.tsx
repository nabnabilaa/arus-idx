"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { LineArea, SignedBars } from "@/components/charts/series";
import { ChartTitle } from "@/components/charts/kit";
import { Term } from "@/components/term";
import { idr, pct } from "@/lib/format";
import { T, useLang } from "@/lib/i18n";
import { BROKER_VERDICT } from "@/lib/narrative";
import type { Bundle } from "@/lib/types";

export function FlowsView({ market, brokers, ranking }: Pick<Bundle, "market" | "brokers" | "ranking">) {
  const { tx, lang } = useLang();
  const rows = Object.entries(brokers)
    .map(([sym, b]) => ({ sym, b, s: ranking.find((r) => r.symbol === sym) }))
    .filter((r) => r.s)
    .sort((a, b) => (b.s!.conf_20 ?? 0) - (a.s!.conf_20 ?? 0));
  const distribution = rows.filter((r) => r.b.tone === "neg");
  const topForeign = [...ranking].filter((r) => r.ff_net_20 != null).sort((a, b) => (b.ff_net_20 ?? 0) - (a.ff_net_20 ?? 0));

  return (
    <div className="pt-12">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }} className="max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
          <T id="Siapa yang membeli, siapa yang menjual" en="Who is buying, who is selling" />
        </h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-2">
          <T
            id="Arus asing menunjukkan arah uang institusi global. Sidik jari broker menunjukkan apakah yang membeli institusi atau ritel. Pola paling berbahaya: institusi keluar diam-diam sementara ritel menampung."
            en="Foreign flow shows where global institutional money is heading. Broker fingerprints show whether institutions or retail are buying. The most dangerous pattern: institutions quietly exit while retail absorbs."
          />
        </p>
      </motion.header>

      <section className="mt-12 grid gap-10 lg:grid-cols-2">
        <div>
          <ChartTitle note={tx({ id: "Satu tahun terakhir.", en: "The last year." })}>IHSG</ChartTitle>
          <LineArea data={market.map((m) => ({ date: m.date, v: m.ihsg }))} height={220} format="index" />
        </div>
        <div>
          <ChartTitle note={tx({ id: "Net beli (biru) dan net jual (merah) investor asing di seluruh bursa, per hari.", en: "Foreign investors' daily net buying (blue) and selling (red) across the whole exchange." })}>
            <Term k="foreignFlow">
              <T id="Arus asing seluruh bursa" en="Exchange-wide foreign flow" />
            </Term>
          </ChartTitle>
          <SignedBars data={market.map((m) => ({ date: m.date, v: m.foreign_net }))} height={220} />
        </div>
      </section>

      <section className="mt-16 grid gap-12 lg:grid-cols-2">
        {[
          { title: { id: "Paling banyak dibeli asing · 20 hari", en: "Most foreign-bought · 20 days" }, list: topForeign.slice(0, 8) },
          { title: { id: "Paling banyak dijual asing · 20 hari", en: "Most foreign-sold · 20 days" }, list: topForeign.slice(-8).reverse() },
        ].map((g) => (
          <div key={g.title.en}>
            <h2 className="text-lg font-semibold tracking-tight">{tx(g.title)}</h2>
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {g.list.map((r) => (
                <li key={r.symbol}>
                  <Link href={`/saham/${r.symbol}/`} className="flex items-center justify-between gap-4 py-2.5 text-[13.5px] hover:text-arus">
                    <span className="font-medium">{r.symbol}</span>
                    <span className="flex items-center gap-5">
                      <span className={`num ${(r.ff_net_20 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{idr(r.ff_net_20, lang)}</span>
                      <span className="num w-10 text-right text-ink-2">{Math.round((r.conf_20 ?? 0.5) * 100)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">
          <Term k="broker">
            <T id="Sidik jari bandar" en="Broker fingerprints" />
          </Term>
        </h2>
        <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-muted">
          <T
            id="Untuk saham peringkat atas: 10 broker pembeli dan penjual terbesar 20 hari terakhir, dibaca lewat registri broker Sectors (institusi/ritel, asing/domestik)."
            en="For top-ranked stocks: the 10 largest buying and selling brokers over the last 20 days, read through the Sectors broker registry (institutional/retail, foreign/domestic)."
          />
        </p>
        {distribution.length > 0 && (
          <p className="mt-4 text-[14px] text-[#f0a3a3]">
            <T id="Waspada pola distribusi:" en="Watch for distribution:" /> {distribution.map((d) => d.sym).join(", ")}
          </p>
        )}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[820px] border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-3 pr-4 font-normal"><T id="Saham" en="Stock" /></th>
                <th className="py-3 pr-4 font-normal"><T id="Pola" en="Pattern" /></th>
                <th className="py-3 pr-4 text-right font-normal"><T id="Institusi" en="Institutional" /></th>
                <th className="py-3 pr-4 text-right font-normal"><T id="Ritel" en="Retail" /></th>
                <th className="py-3 pr-4 text-right font-normal"><T id="Asing" en="Foreign" /></th>
                <th className="py-3 pr-4 text-right font-normal"><T id="Konsentrasi top-3" en="Top-3 share" /></th>
                <th className="py-3 pr-4 font-normal"><T id="Pembeli utama" en="Top buyers" /></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ sym, b }) => (
                <tr key={sym} className="hover:bg-surface">
                  <td className="border-t border-line py-3 pr-4">
                    <Link href={`/saham/${sym}/`} className="font-semibold text-ink hover:text-arus">{sym}</Link>
                  </td>
                  <td className={`border-t border-line py-3 pr-4 ${b.tone === "pos" ? "text-[#8fbcf3]" : b.tone === "neg" ? "text-[#f0a3a3]" : "text-ink-2"}`}>
                    {tx(BROKER_VERDICT[b.verdict] ?? { id: b.verdict, en: b.verdict })}
                  </td>
                  <td className={`num border-t border-line py-3 pr-4 text-right ${b.inst_net >= 0 ? "text-up" : "text-down"}`}>{idr(b.inst_net, lang)}</td>
                  <td className={`num border-t border-line py-3 pr-4 text-right ${b.retail_net >= 0 ? "text-up" : "text-down"}`}>{idr(b.retail_net, lang)}</td>
                  <td className={`num border-t border-line py-3 pr-4 text-right ${b.foreign_investor_net >= 0 ? "text-up" : "text-down"}`}>{idr(b.foreign_investor_net, lang)}</td>
                  <td className="num border-t border-line py-3 pr-4 text-right text-ink">{pct(b.top3_share)}</td>
                  <td className="border-t border-line py-3 pr-4 text-ink-2">{b.top_buyers.slice(0, 3).map((x) => x.code).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="py-8 text-[14px] text-muted"><T id="Belum ada data broker." en="No broker data yet." /></p>}
        </div>
      </section>
    </div>
  );
}

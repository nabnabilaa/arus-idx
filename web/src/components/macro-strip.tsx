"use client";

import { motion } from "motion/react";
import { C } from "@/components/charts/kit";
import { dateLabel, idr, signed } from "@/lib/format";
import { useLang, type Bi } from "@/lib/i18n";
import type { Bundle } from "@/lib/types";

const EASE = [0.23, 1, 0.32, 1] as const;
/** A monthly commodity print older than this is not "today's" market and is left off the strip. */
const FRESH_DAYS = 60;

type Tile = { key: string; label: Bi; value: string; chg: number | null; chgLabel: Bi; spark: number[]; date?: string; goodUp?: boolean };

function Spark({ v, up }: { v: number[]; up: boolean }) {
  if (v.length < 2) return null;
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const d = v.map((x, i) => `${i ? "L" : "M"}${((i / (v.length - 1)) * 100).toFixed(1)},${(hi === lo ? 12 : 22 - ((x - lo) / (hi - lo)) * 20).toFixed(1)}`).join("");
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="mt-2 h-6 w-full" aria-hidden>
      <path d={d} fill="none" stroke={up ? C.up : C.down} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Today's backdrop in one row: index, foreign flow, rupiah, oil, gold, Wall Street, fear gauge. */
export function MacroStrip({ market, macro, asOf }: { market: Bundle["market"]; macro: Bundle["macro"]; asOf: string }) {
  const { tx, lang } = useLang();
  const nf = (x: number, d = 0) => x.toLocaleString(lang === "id" ? "id-ID" : "en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
  const ih = market.filter((m) => m.ihsg != null);
  const lastI = ih.at(-1)?.ihsg ?? null;
  const prevI = ih.at(-2)?.ihsg ?? null;
  const ff = market.at(-1)?.foreign_net ?? null;
  const fresh = (d: string) => (new Date(asOf).getTime() - new Date(d).getTime()) / 864e5 <= FRESH_DAYS;
  const ser = (k: keyof Bundle["macro"]["series"]) => macro.series[k]?.v.slice(-40) ?? [];
  const r = macro.recent;
  const com = macro.commodities ?? {};

  const tiles: Tile[] = [
    { key: "ihsg", label: { id: "IHSG", en: "IHSG" }, value: lastI != null ? nf(lastI) : "–", chg: lastI && prevI ? lastI / prevI - 1 : null, chgLabel: { id: "hari ini", en: "today" }, spark: ih.slice(-40).map((m) => m.ihsg as number), goodUp: true },
    { key: "ff", label: { id: "Asing bersih", en: "Foreign net" }, value: idr(ff, lang), chg: null, chgLabel: { id: "hari ini", en: "today" }, spark: market.slice(-20).map((m) => m.foreign_net ?? 0), goodUp: (ff ?? 0) >= 0 },
    ...(r.idr ? [{ key: "idr", label: { id: "USD/IDR", en: "USD/IDR" }, value: nf(r.idr.last), chg: r.idr.d5 ?? null, chgLabel: { id: "5 hari", en: "5 days" }, spark: ser("idr"), goodUp: false, date: r.idr.date }] : []),
    ...(r.oil ? [{ key: "oil", label: { id: "Minyak Brent", en: "Brent oil" }, value: `$${nf(r.oil.last, 1)}`, chg: r.oil.d5 ?? null, chgLabel: { id: "5 hari", en: "5 days" }, spark: ser("oil"), date: r.oil.date }] : []),
    ...(com.gold && fresh(com.gold.date) ? [{ key: "gold", label: { id: "Emas", en: "Gold" }, value: `$${nf(com.gold.last)}`, chg: com.gold.chg, chgLabel: { id: "vs bulan lalu", en: "vs last month" }, spark: com.gold.series.v, date: com.gold.date }] : []),
    ...(["coal", "nickel", "copper"] as const)
      .filter((k) => com[k] && fresh(com[k]!.date))
      .map((k) => ({
        key: k,
        label: { coal: { id: "Batu bara", en: "Coal" }, nickel: { id: "Nikel", en: "Nickel" }, copper: { id: "Tembaga", en: "Copper" } }[k],
        value: `$${nf(com[k]!.last)}`,
        chg: com[k]!.chg,
        chgLabel: { id: "vs cetak lalu", en: "vs last print" },
        spark: com[k]!.series.v,
        date: com[k]!.date,
      })),
    ...(r.spx ? [{ key: "spx", label: { id: "S&P 500", en: "S&P 500" }, value: nf(r.spx.last), chg: r.spx.d5 ?? null, chgLabel: { id: "5 hari", en: "5 days" }, spark: ser("spx"), goodUp: true, date: r.spx.date }] : []),
    ...(r.vix ? [{ key: "vix", label: { id: "VIX (rasa takut)", en: "VIX (fear)" }, value: nf(r.vix.last, 1), chg: r.vix.d5 != null && r.vix.last ? r.vix.d5 / (r.vix.last - r.vix.d5) : null, chgLabel: { id: "5 hari", en: "5 days" }, spark: ser("vix"), goodUp: false, date: r.vix.date }] : []),
  ];

  return (
    <section className="mb-8">
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none">
        {tiles.map((t, i) => {
          const up = t.key === "ff" ? (ff ?? 0) >= 0 : (t.chg ?? 0) >= 0;
          const good = t.goodUp === undefined ? null : t.goodUp === up;
          return (
            <motion.div
              key={t.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.03, ease: EASE }}
              title={t.date ? tx({ id: `Data ${dateLabel(t.date, "id")}`, en: `As of ${dateLabel(t.date, "en")}` }) : undefined}
              className="w-36 shrink-0 snap-start rounded-xl bg-surface px-3 py-2.5 ring-1 ring-line sm:w-auto"
            >
              <div className="truncate text-[11.5px] text-muted">{tx(t.label)}</div>
              <div className={`num mt-0.5 text-[15px] font-semibold ${t.key === "ff" ? (up ? "text-up" : "text-down") : "text-ink"}`}>{t.value}</div>
              <div className={`num text-[11px] ${t.chg == null ? "text-muted" : good === false ? "text-down" : good === true ? "text-up" : "text-ink-2"}`}>
                {t.chg != null ? `${signed(t.chg * 100, 1, "%")} ` : ""}
                <span className="text-muted">{tx(t.chgLabel)}</span>
              </div>
              <Spark v={t.spark} up={t.key === "ff" ? up : (t.spark.at(-1) ?? 0) >= (t.spark[0] ?? 0)} />
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

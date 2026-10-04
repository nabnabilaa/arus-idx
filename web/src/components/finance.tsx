"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Check, Minus, X } from "lucide-react";
import { FIN_GRADE } from "@/components/perspectives";
import { idr, pct, signed } from "@/lib/format";
import { T, useLang, type Bi } from "@/lib/i18n";
import type { FinCheck, FinGrade, FinHealth, Stock } from "@/lib/types";

const EASE = [0.23, 1, 0.32, 1] as const;

const CHECK: Record<FinCheck, { label: Bi; why: Bi }> = {
  profit: { label: { id: "Perusahaan untung", en: "The company is profitable" }, why: { id: "Laba bersih tahun terakhir positif.", en: "Net profit in the latest year was positive." } },
  cash: { label: { id: "Bisnis inti menghasilkan uang tunai", en: "Core business generates cash" }, why: { id: "Arus kas dari operasi positif.", en: "Operating cash flow was positive." } },
  roa_up: { label: { id: "Makin efisien mencetak laba", en: "Getting more efficient at profit" }, why: { id: "Laba dibanding total aset (ROA) naik dari tahun sebelumnya.", en: "Profit relative to total assets (ROA) rose year on year." } },
  cash_backed: { label: { id: "Laba didukung uang nyata", en: "Profit backed by real cash" }, why: { id: "Arus kas operasi lebih besar dari laba, jadi labanya bukan cuma di atas kertas.", en: "Operating cash exceeded profit, so earnings aren't just on paper." } },
  leverage_down: { label: { id: "Beban utang berkurang", en: "Debt burden falling" }, why: { id: "Porsi kewajiban terhadap aset turun.", en: "Liabilities as a share of assets fell." } },
  liquidity_up: { label: { id: "Lebih mampu bayar utang jangka pendek", en: "Better able to pay short-term bills" }, why: { id: "Aset lancar dibanding utang lancar naik.", en: "Current assets relative to current liabilities rose." } },
  no_dilution: { label: { id: "Kepemilikan tidak diencerkan", en: "No share dilution" }, why: { id: "Jumlah saham beredar tidak bertambah.", en: "Shares outstanding didn't increase." } },
  margin_up: { label: { id: "Margin kotor membaik", en: "Gross margin improving" }, why: { id: "Laba kotor per rupiah penjualan naik.", en: "Gross profit per rupiah of sales rose." } },
  turnover_up: { label: { id: "Aset makin produktif", en: "Assets more productive" }, why: { id: "Penjualan dibanding total aset naik.", en: "Sales relative to total assets rose." } },
};

function Bars({ years, rows }: { years: string[]; rows: { key: string; label: string; color: string; values: (number | null)[] }[] }) {
  const { lang } = useLang();
  const all = rows.flatMap((r) => r.values.filter((v): v is number => v != null));
  const max = Math.max(...all.map(Math.abs), 1);
  const hasNeg = all.some((v) => v < 0);
  const H = 150;
  const zero = hasNeg ? H * 0.72 : H;
  const scale = (v: number) => (Math.abs(v) / max) * (hasNeg ? H * 0.72 : H);
  return (
    <div>
      <div className="flex items-end gap-3 sm:gap-5" style={{ height: H + 22 }}>
        {years.map((y, i) => (
          <div key={y} className="flex flex-1 flex-col items-center">
            <div className="relative flex w-full justify-center gap-1" style={{ height: H }}>
              {hasNeg && <div className="absolute inset-x-0 h-px bg-line-strong" style={{ top: zero }} />}
              {rows.map((r) => {
                const v = r.values[i];
                const h = v == null ? 0 : Math.max(2, scale(v));
                return (
                  <div key={r.key} className="relative h-full w-1/4 max-w-7">
                    {v != null && (
                      <motion.div
                        title={`${r.label} ${y}: ${idr(v, lang)}`}
                        className={`absolute inset-x-0 ${v >= 0 ? "rounded-t-[3px]" : "rounded-b-[3px]"}`}
                        style={{ background: v < 0 ? "#e66767" : r.color, bottom: v >= 0 ? H - zero : H - zero - h }}
                        initial={{ height: 0 }}
                        animate={{ height: h }}
                        transition={{ duration: 0.6, delay: i * 0.05, ease: EASE }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="num mt-1.5 text-[11.5px] text-muted">{y}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmt(v: number, u: "idr" | "pct" | "x" | "shares", lang: "id" | "en") {
  if (u === "idr") return idr(v, lang);
  if (u === "pct") return pct(v, 1);
  if (u === "x") return `${v.toFixed(2)}×`;
  return `${(v / 1e9).toFixed(2)} ${lang === "id" ? "miliar lembar" : "bn shares"}`;
}

type Row = { l: Bi; v: (number | null)[]; kind: "idr" | "pct" | "dps"; strong?: boolean };

/** Full five-year statement in rupiah, with the latest year-on-year change. */
function Statement({ fin }: { fin: FinHealth }) {
  const { tx, lang } = useLang();
  const S = fin.series;
  const ratio = (a: (number | null)[], b: (number | null)[]) => a.map((x, i) => (x != null && b[i] ? x / (b[i] as number) : null));
  const all: Row[] = [
    { l: { id: "Pendapatan", en: "Revenue" }, v: S.revenue, kind: "idr", strong: true },
    { l: { id: "Laba kotor", en: "Gross profit" }, v: S.gross_profit, kind: "idr" },
    { l: { id: "Margin kotor", en: "Gross margin" }, v: ratio(S.gross_profit, S.revenue), kind: "pct" },
    { l: { id: "Laba bersih", en: "Net profit" }, v: S.earnings, kind: "idr", strong: true },
    { l: { id: "Margin bersih", en: "Net margin" }, v: ratio(S.earnings, S.revenue), kind: "pct" },
    { l: { id: "Arus kas operasi", en: "Operating cash flow" }, v: S.operating_cash_flow, kind: "idr" },
    { l: { id: "Free cash flow", en: "Free cash flow" }, v: S.free_cash_flow, kind: "idr" },
    { l: { id: "Total aset", en: "Total assets" }, v: S.total_assets, kind: "idr" },
    { l: { id: "Total liabilitas", en: "Total liabilities" }, v: S.total_liabilities, kind: "idr" },
    { l: { id: "Ekuitas", en: "Equity" }, v: S.total_equity, kind: "idr", strong: true },
    { l: { id: "Utang berbunga", en: "Interest-bearing debt" }, v: S.total_debt, kind: "idr" },
    { l: { id: "ROE", en: "ROE" }, v: ratio(S.earnings, S.total_equity), kind: "pct" },
    { l: { id: "Dividen per saham", en: "Dividend per share" }, v: S.total_dividend, kind: "dps" },
  ];
  const rows = all.filter((r) => r.v.some((x) => x != null));
  const show = (x: number | null, k: Row["kind"]) =>
    x == null ? "–" : k === "idr" ? idr(x, lang) : k === "pct" ? pct(x, 1) : `Rp${x.toLocaleString(lang === "id" ? "id-ID" : "en-US", { maximumFractionDigits: 1 })}`;
  const change = (r: Row) => {
    const last = r.v.at(-1) ?? null;
    const prev = r.v.at(-2) ?? null;
    if (last == null || prev == null) return null;
    if (r.kind === "pct") return { v: (last - prev) * 100, pts: true };
    if (!prev) return null;
    return { v: ((last - prev) / Math.abs(prev)) * 100, pts: false };
  };
  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-line">
      <h3 className="text-[16px] font-semibold">
        <T id="Laporan keuangan tahunan" en="Annual statements" />
      </h3>
      <p className="mt-1 text-[12.5px] text-muted">
        <T id="Dalam rupiah. Kolom terakhir: perubahan dibanding tahun sebelumnya." en="In rupiah. Last column: change versus the year before." />
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-right text-[11.5px] text-muted">
              <th className="py-2 pr-4 text-left font-normal" />
              {fin.years.map((y) => (
                <th key={y} className="num py-2 pr-4 font-normal">
                  {y}
                </th>
              ))}
              <th className="py-2 font-normal">{tx({ id: "Perubahan", en: "Change" })}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const ch = change(r);
              return (
                <tr key={r.l.en} className="num text-right">
                  <td className={`border-t border-line py-2 pr-4 text-left ${r.strong ? "font-medium text-ink" : "text-ink-2"}`}>{tx(r.l)}</td>
                  {r.v.map((x, i) => (
                    <td key={i} className={`border-t border-line py-2 pr-4 ${x != null && x < 0 ? "text-down" : r.strong ? "text-ink" : "text-ink-2"}`}>
                      {show(x, r.kind)}
                    </td>
                  ))}
                  <td className={`border-t border-line py-2 ${ch == null ? "text-muted" : ch.v >= 0 ? "text-up" : "text-down"}`}>
                    {ch == null ? "–" : ch.pts ? `${signed(ch.v, 1)} ${tx({ id: "poin", en: "pts" })}` : signed(ch.v, 1, "%")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function FinanceTab({ s, fin, peers }: { s: Stock; fin: FinHealth | null; peers: { symbol: string; name: string | null; fin_grade?: FinGrade | null; fin_score?: number | null; fin_n?: number | null; pct_value?: number | null; rev_cagr?: number | null }[] }) {
  const { tx, lang } = useLang();
  const card = "rounded-2xl bg-surface p-5 ring-1 ring-line";
  const stats: [Bi, string][] = [
    [{ id: "PER (TTM)", en: "P/E (TTM)" }, s.pe_ttm != null ? `${s.pe_ttm.toFixed(1)}×` : "–"],
    [{ id: "PBV", en: "P/B" }, s.pb_mrq != null ? `${s.pb_mrq.toFixed(2)}×` : "–"],
    [{ id: "ROE", en: "ROE" }, pct(s.roe_ttm, 1)],
    [{ id: "Utang / ekuitas", en: "Debt / equity" }, s.der_mrq != null ? `${s.der_mrq.toFixed(2)}×` : "–"],
    [{ id: "Dividen yield", en: "Dividend yield" }, pct(s.yield_ttm, 1)],
    [{ id: "Harga vs nilai intrinsik", en: "Price vs intrinsic" }, s.upside_intrinsic != null ? signed(s.upside_intrinsic * 100, 0, "%") : "–"],
    [{ id: "Kapitalisasi", en: "Market cap" }, idr(s.market_cap, lang)],
    [{ id: "Margin laba bersih", en: "Net margin" }, pct(fin?.net_margin, 1)],
  ];
  const vs: [Bi, number | null][] = [
    [{ id: "Seberapa murah", en: "How cheap" }, s.pct_value],
    [{ id: "Kualitas bisnis", en: "Business quality" }, s.pct_quality],
    [{ id: "Pertumbuhan", en: "Growth" }, s.pct_growth],
  ];

  return (
    <div className="space-y-5">
      {fin ? (
        <>
          {/* 1. verdict and key figures */}
          <section className={`${card} grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)] lg:items-center`}>
            <div>
              <div className="text-[12.5px] text-muted">
                <T id="Kesehatan keuangan" en="Financial health" />
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <span className={`text-3xl font-semibold tracking-tight ${FIN_GRADE[fin.grade].tone}`}>{tx(FIN_GRADE[fin.grade].label)}</span>
                <span className="num text-[14px] text-ink-2">
                  {fin.score}/{fin.n} {tx({ id: "lolos", en: "passed" })}
                </span>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                {tx({
                  id: `Laporan tahunan ${fin.prev} → ${fin.year}, kerangka F-Score Piotroski.`,
                  en: `Annual reports ${fin.prev} → ${fin.year}, Piotroski F-Score framework.`,
                })}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                [{ id: "Pendapatan / tahun", en: "Revenue / yr" }, fin.rev_cagr != null ? signed(fin.rev_cagr * 100, 1, "%") : "–", (fin.rev_cagr ?? 0) >= 0],
                [{ id: "Laba / tahun", en: "Profit / yr" }, fin.eps_cagr != null ? signed(fin.eps_cagr * 100, 1, "%") : "–", (fin.eps_cagr ?? 0) >= 0],
                [{ id: "Margin bersih", en: "Net margin" }, pct(fin.net_margin, 1), true],
                [{ id: "ROA", en: "ROA" }, pct(fin.roa, 1), true],
                [{ id: "Tahun untung", en: "Profitable years" }, `${fin.profitable_years}/${fin.years.length}`, true],
                [{ id: "Tahun bayar dividen", en: "Dividend years" }, `${fin.dividend_years}/${fin.years.length}`, true],
              ].map(([l, v, ok]) => (
                <div key={(l as Bi).en} className="rounded-lg bg-ground/60 px-3 py-2.5 ring-1 ring-line">
                  <dt className="text-[11.5px] text-muted">{tx(l as Bi)}</dt>
                  <dd className={`num text-[17px] font-semibold ${ok ? "text-ink" : "text-[#f0a3a3]"}`}>{v as string}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* 2. the checks */}
          <section className={card}>
            <h3 className="text-[15px] font-semibold">
              <T id="Pemeriksaan kesehatan" en="Health checks" />
            </h3>
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {fin.checks.map((c, i) => (
                <motion.li key={c.k} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: i * 0.03, ease: EASE }} className="flex gap-3 rounded-xl bg-ground/60 p-3 ring-1 ring-line">
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${c.ok ? "bg-aqua/15 text-[#7fd4a8]" : "bg-down/15 text-[#f0a3a3]"}`}>
                    {c.ok ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                  </span>
                  <div className="min-w-0">
                    <div className={`text-[13.5px] font-medium ${c.ok ? "text-ink" : "text-ink-2"}`}>{tx(CHECK[c.k].label)}</div>
                    {c.a != null && c.b != null && (
                      <div className="num mt-0.5 text-[12px] text-ink-2">
                        {c.k === "cash_backed"
                          ? tx({ id: `Laba ${fmt(c.a, c.u, lang)} · kas ${fmt(c.b, c.u, lang)}`, en: `Profit ${fmt(c.a, c.u, lang)} · cash ${fmt(c.b, c.u, lang)}` })
                          : `${fmt(c.a, c.u, lang)} → ${fmt(c.b, c.u, lang)}`}
                      </div>
                    )}
                    <div className="mt-0.5 text-[11.5px] leading-snug text-muted">{tx(CHECK[c.k].why)}</div>
                  </div>
                </motion.li>
              ))}
            </ul>
          </section>

          {/* 3. five-year picture */}
          <section className={card}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-[15px] font-semibold">
                <T id="Pendapatan, laba, dan arus kas, 5 tahun" en="Revenue, profit and cash, 5 years" />
              </h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#3987e5]" />{tx({ id: "Pendapatan", en: "Revenue" })}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#5cc8ff]" />{tx({ id: "Laba bersih", en: "Net profit" })}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#7fd4a8]" />{tx({ id: "Arus kas operasi", en: "Operating cash" })}</span>
              </div>
            </div>
            <div className="mt-5">
              <Bars
                years={fin.years}
                rows={[
                  { key: "rev", label: tx({ id: "Pendapatan", en: "Revenue" }), color: "#3987e5", values: fin.series.revenue },
                  { key: "earn", label: tx({ id: "Laba bersih", en: "Net profit" }), color: "#5cc8ff", values: fin.series.earnings },
                  { key: "ocf", label: tx({ id: "Arus kas operasi", en: "Operating cash" }), color: "#7fd4a8", values: fin.series.operating_cash_flow },
                ]}
              />
            </div>
          </section>

          {/* 4. statements */}
          <Statement fin={fin} />
        </>
      ) : (
        <p className={`${card} text-[14px] text-ink-2`}>
          <T id="Laporan keuangan tahunan belum tersedia untuk saham ini." en="Annual statements aren't available for this stock yet." />
        </p>
      )}

      {/* 5. valuation and sector standing */}
      <section className={card}>
        <h3 className="text-[15px] font-semibold">
          <T id="Valuasi dan posisi di sektornya" en="Valuation and sector standing" />
        </h3>
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map(([l, val]) => (
            <div key={l.en} className="rounded-lg bg-ground/60 px-3 py-2.5 ring-1 ring-line">
              <dt className="text-[11.5px] text-muted">{tx(l)}</dt>
              <dd className="num text-[16px] text-ink">{val}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          {vs.map(([l, val]) => (
            <div key={l.en}>
              <div className="flex justify-between gap-3 text-[13px]">
                <span className="text-ink-2">{tx(l)}</span>
                <span className="num text-ink">{val == null ? "–" : `${Math.round(val * 100)}%`}</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-raised">
                {val != null && <motion.div className="h-2 rounded-full bg-arus" initial={{ width: 0 }} animate={{ width: `${Math.max(3, val * 100)}%` }} transition={{ duration: 0.7, ease: EASE }} />}
              </div>
              <div className="mt-1 text-[11px] text-muted">{tx({ id: "lebih baik dari sekian persen sesama sektor", en: "better than this share of sector peers" })}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. peers */}
      {peers.length > 0 && (
        <section className={card}>
          <h3 className="text-[15px] font-semibold">
            <T id="Dibanding sesama subsektor" en="Versus subsector peers" />
          </h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] border-separate border-spacing-0 text-[13px]">
              <thead>
                <tr className="text-right text-[11.5px] text-muted">
                  <th className="py-2 pr-4 text-left font-normal">{tx({ id: "Saham", en: "Stock" })}</th>
                  <th className="py-2 pr-4 font-normal">{tx({ id: "Pendapatan / tahun", en: "Revenue / yr" })}</th>
                  <th className="py-2 pr-4 font-normal">{tx({ id: "Seberapa murah", en: "How cheap" })}</th>
                  <th className="py-2 font-normal">{tx({ id: "Kesehatan", en: "Health" })}</th>
                </tr>
              </thead>
              <tbody>
                {peers.map((p) => (
                  <tr key={p.symbol} className="num text-right hover:bg-raised/30">
                    <td className="border-t border-line py-2 pr-4 text-left">
                      <Link href={`/saham/${p.symbol}/`} className="font-semibold text-ink hover:text-arus">
                        {p.symbol}
                      </Link>
                      <span className="ml-2 text-[12px] text-muted">{p.name}</span>
                    </td>
                    <td className={`border-t border-line py-2 pr-4 ${(p.rev_cagr ?? 0) >= 0 ? "text-ink-2" : "text-[#f0a3a3]"}`}>{p.rev_cagr != null ? signed(p.rev_cagr * 100, 1, "%") : "–"}</td>
                    <td className="border-t border-line py-2 pr-4 text-ink-2">{p.pct_value != null ? `${Math.round(p.pct_value * 100)}%` : "–"}</td>
                    <td className={`border-t border-line py-2 ${p.fin_grade ? FIN_GRADE[p.fin_grade].tone : "text-muted"}`}>
                      {p.fin_grade ? `${tx(FIN_GRADE[p.fin_grade].label)} ${p.fin_score}/${p.fin_n}` : <Minus size={14} className="ml-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="text-[12px] text-muted">
        <T
          id="Sumber: laporan keuangan tahunan dan rasio terkini dari Sectors. Kesehatan keuangan menggambarkan kondisi perusahaan, bukan perkiraan harga sahamnya."
          en="Source: annual statements and current ratios from Sectors. Financial health describes the company's condition, not a forecast of its share price."
        />
      </p>
    </div>
  );
}

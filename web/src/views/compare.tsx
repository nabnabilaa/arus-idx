"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FIN_GRADE } from "@/components/perspectives";
import { idr, pct, price, signed } from "@/lib/format";
import { T, useLang, type Bi } from "@/lib/i18n";
import type { CompactStock } from "@/lib/types";
import { VERDICT, verdictOf } from "@/lib/verdict";

const EASE = [0.23, 1, 0.32, 1] as const;
const COLORS = ["#5cc8ff", "#fab219", "#e87ba4", "#7fd4a8"];

function Chart({ items }: { items: CompactStock[] }) {
  const W = 760, H = 220;
  const lines = items.map((s) => (s.closes.length ? s.closes.map((c) => c / s.closes[0] - 1) : []));
  const all = lines.flat();
  if (!all.length) return null;
  const lo = Math.min(...all, 0), hi = Math.max(...all, 0);
  const y = (v: number) => H - 14 - ((v - lo) / (hi - lo || 1)) * (H - 28);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden>
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="rgb(148 163 184 / 0.22)" strokeDasharray="4 4" />
      {lines.map((l, k) => (
        <path key={k} d={l.map((v, i) => `${i ? "L" : "M"} ${(i / Math.max(1, l.length - 1)) * W} ${y(v)}`).join(" ")} fill="none" stroke={COLORS[k]} strokeWidth={2} strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/** Two to four stocks side by side, from the same compact rows the watchlist uses. */
export function CompareView({ stocks }: { stocks: CompactStock[] }) {
  const { tx, lang } = useLang();
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("s");
    const init = s ? s.split(",").map((x) => x.trim().toUpperCase()).filter((x) => stocks.some((y) => y.symbol === x)).slice(0, 4) : [];
    // the page is exported statically, so the URL can only be read after mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPicked(init.length ? init : ["BBCA", "BBRI"].filter((x) => stocks.some((y) => y.symbol === x)));
  }, [stocks]);
  useEffect(() => {
    if (picked.length) window.history.replaceState(null, "", `?s=${picked.join(",")}`);
  }, [picked]);

  const items = picked.map((s) => stocks.find((x) => x.symbol === s)!).filter(Boolean);
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return stocks.filter((x) => !picked.includes(x.symbol) && (x.symbol.toLowerCase().startsWith(t) || (x.name ?? "").toLowerCase().includes(t))).slice(0, 6);
  }, [q, stocks, picked]);

  const rows: { l: Bi; v: (s: CompactStock) => React.ReactNode; best?: (s: CompactStock) => number | null }[] = [
    { l: { id: "Harga", en: "Price" }, v: (s) => price(s.price, lang) },
    { l: { id: "Hari ini", en: "Today" }, v: (s) => <span className={(s.ret_1 ?? 0) >= 0 ? "text-up" : "text-down"}>{signed((s.ret_1 ?? 0) * 100, 1, "%")}</span> },
    { l: { id: "1 bulan", en: "1 month" }, v: (s) => <span className={(s.ret_20 ?? 0) >= 0 ? "text-up" : "text-down"}>{signed((s.ret_20 ?? 0) * 100, 1, "%")}</span>, best: (s) => s.ret_20 },
    { l: { id: "Penilaian besok", en: "Next-day call" }, v: (s) => <span style={{ color: VERDICT[verdictOf(s.q_1)].color }}>{tx(VERDICT[verdictOf(s.q_1)].label)}</span>, best: (s) => s.q_1 },
    { l: { id: "Rentang wajar 1 bulan", en: "1-month range" }, v: (s) => (s.month ? `${price(s.month[0], lang)} – ${price(s.month[1], lang)}` : "–") },
    { l: { id: "Gerak normal harian", en: "Normal daily move" }, v: (s) => `±${pct(s.atr_pct, 1)}` },
    { l: { id: "Kesehatan keuangan", en: "Financial health" }, v: (s) => (s.fin_grade ? <span className={FIN_GRADE[s.fin_grade].tone}>{tx(FIN_GRADE[s.fin_grade].label)} {s.fin_score}/{s.fin_n}</span> : "–"), best: (s) => (s.fin_n ? (s.fin_score ?? 0) / s.fin_n : null) },
    { l: { id: "Pendapatan / tahun", en: "Revenue / yr" }, v: (s) => (s.rev_cagr != null ? signed(s.rev_cagr * 100, 1, "%") : "–"), best: (s) => s.rev_cagr },
    { l: { id: "PER", en: "P/E" }, v: (s) => (s.pe_ttm != null ? `${s.pe_ttm.toFixed(1)}×` : "–"), best: (s) => (s.pe_ttm != null && s.pe_ttm > 0 ? -s.pe_ttm : null) },
    { l: { id: "PBV", en: "P/B" }, v: (s) => (s.pb_mrq != null ? `${s.pb_mrq.toFixed(2)}×` : "–") },
    { l: { id: "ROE", en: "ROE" }, v: (s) => pct(s.roe_ttm, 1), best: (s) => s.roe_ttm },
    { l: { id: "Dividen", en: "Dividend" }, v: (s) => pct(s.yield_ttm, 1), best: (s) => s.yield_ttm },
    { l: { id: "Kapitalisasi", en: "Market cap" }, v: (s) => idr(s.market_cap, lang) },
    { l: { id: "Asing sebulan", en: "Foreign, 1 mo" }, v: (s) => <span className={(s.ff_net_20 ?? 0) >= 0 ? "text-up" : "text-down"}>{idr(s.ff_net_20, lang)}</span>, best: (s) => s.ff_net_20 },
    {
      l: { id: "Arah broker 5 hari", en: "Broker tilt, 5 days" },
      v: (s) =>
        s.tilt5 == null ? "–" : s.tilt5 > 0.15 ? <span className="text-up">{tx({ id: "Akumulasi", en: "Accumulation" })}</span> : s.tilt5 < -0.15 ? <span className="text-down">{tx({ id: "Distribusi", en: "Distribution" })}</span> : tx({ id: "Seimbang", en: "Balanced" }),
    },
  ];

  return (
    <div className="pt-10 sm:pt-12">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="max-w-3xl">
        <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-balance sm:text-5xl">
          <T id="Bandingkan saham" en="Compare stocks" />
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
          <T id="Pilih 2 sampai 4 saham untuk dilihat berdampingan: gerak harga, penilaian, kesehatan keuangan, valuasi, dan arah uang besar. Nilai terbaik di tiap baris ditandai." en="Pick 2 to 4 stocks to see side by side: price action, verdict, financial health, valuation and where big money is going. The best value in each row is highlighted." />
        </p>
      </motion.header>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        {items.map((s, k) => (
          <span key={s.symbol} className="inline-flex items-center gap-2 rounded-full bg-surface py-1.5 pl-3 pr-1.5 text-[13.5px] ring-1 ring-line">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[k] }} />
            <span className="font-semibold text-ink">{s.symbol}</span>
            <button onClick={() => setPicked((p) => p.filter((x) => x !== s.symbol))} aria-label={tx({ id: `Hapus ${s.symbol}`, en: `Remove ${s.symbol}` })} className="grid h-6 w-6 cursor-pointer place-items-center rounded-full text-muted hover:bg-raised hover:text-ink">
              <X size={13} />
            </button>
          </span>
        ))}
        {picked.length < 4 && (
          <div className="relative">
            <label className="flex h-9 items-center gap-2 rounded-full bg-surface px-3 ring-1 ring-line focus-within:ring-arus/60">
              <Plus size={14} className="text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx({ id: "Tambah saham", en: "Add a stock" })} className="w-36 bg-transparent text-[13px] text-ink placeholder:text-muted focus:outline-none" />
            </label>
            {matches.length > 0 && (
              <ul className="absolute left-0 top-11 z-20 w-72 overflow-hidden rounded-xl bg-raised ring-1 ring-line-strong">
                {matches.map((m) => (
                  <li key={m.symbol}>
                    <button
                      onClick={() => {
                        setPicked((p) => [...p, m.symbol].slice(0, 4));
                        setQ("");
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left hover:bg-surface"
                    >
                      <span className="font-semibold text-ink">{m.symbol}</span>
                      <span className="truncate text-[12px] text-muted">{m.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <>
          <section className="mt-6 rounded-2xl bg-surface p-5 ring-1 ring-line">
            <div className="text-[13px] text-muted">{tx({ id: "Gerak harga 3 bulan, dimulai dari titik yang sama", en: "3-month price action, rebased to the same start" })}</div>
            <div className="mt-3">
              <Chart items={items} />
            </div>
          </section>

          <section className="mt-5 overflow-x-auto rounded-2xl bg-surface ring-1 ring-line">
            <table className="w-full min-w-[560px] border-separate border-spacing-0 text-[13.5px]">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-[12px] font-normal text-muted" />
                  {items.map((s, k) => (
                    <th key={s.symbol} className="px-4 py-3 text-right">
                      <Link href={`/saham/${s.symbol}/`} className="inline-flex items-center gap-2 font-semibold text-ink hover:text-arus">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[k] }} />
                        {s.symbol}
                      </Link>
                      <div className="truncate text-[11.5px] font-normal text-muted">{s.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const scores = r.best ? items.map((s) => r.best!(s)) : [];
                  const top = scores.filter((x): x is number => x != null);
                  const bestIdx = top.length > 1 ? scores.indexOf(Math.max(...top)) : -1;
                  return (
                    <tr key={r.l.en}>
                      <td className="border-t border-line px-4 py-2.5 text-[12.5px] text-muted">{tx(r.l)}</td>
                      {items.map((s, k) => (
                        <td key={s.symbol} className={`num border-t border-line px-4 py-2.5 text-right text-ink ${k === bestIdx ? "bg-arus/8 font-semibold" : ""}`}>
                          {r.v(s)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
          <p className="mt-3 text-[12px] text-muted">
            <T id="Sel yang disorot = nilai terbaik di baris itu (PER: paling rendah selama positif). Ini perbandingan data, bukan rekomendasi." en="Highlighted cell = the best value in that row (P/E: lowest while positive). A data comparison, not a recommendation." />
          </p>
        </>
      )}
    </div>
  );
}

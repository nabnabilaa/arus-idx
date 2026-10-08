"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Crown, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FIN_GRADE } from "@/components/perspectives";
import { idr, pct, price, signed } from "@/lib/format";
import { T, useLang, type Bi } from "@/lib/i18n";
import type { CompactStock } from "@/lib/types";
import { VERDICT, verdictOf } from "@/lib/verdict";

const EASE = [0.23, 1, 0.32, 1] as const;
const COLORS = ["#5cc8ff", "#fab219", "#e87ba4", "#7fd4a8"];

const ret3 = (s: CompactStock) => (s.closes.length > 1 ? s.closes[s.closes.length - 1] / s.closes[0] - 1 : null);

/** Rebased price lines with the latest change written at each line's end. */
function Chart({ items }: { items: CompactStock[] }) {
  const { lang } = useLang();
  const W = 640;
  const H = 210;
  const padR = 64;
  const lines = items.map((s) => (s.closes.length ? s.closes.map((c) => c / s.closes[0] - 1) : []));
  const all = lines.flat();
  if (!all.length) return null;
  const lo = Math.min(...all, 0);
  const hi = Math.max(...all, 0);
  const y = (v: number) => H - 16 - ((v - lo) / (hi - lo || 1)) * (H - 32);
  const x = (i: number, n: number) => (i / Math.max(1, n - 1)) * (W - padR);
  const pctL = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1).replace(".", lang === "id" ? "," : ".")}%`;
  // keep end labels from overlapping: nudge them apart vertically
  const ends = lines.map((l, k) => ({ k, v: l[l.length - 1] ?? 0, y: y(l[l.length - 1] ?? 0) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="price">
      <line x1={0} x2={W - padR} y1={y(0)} y2={y(0)} stroke="rgb(148 163 184 / 0.25)" strokeDasharray="4 4" />
      {lines.map((l, k) => (
        <motion.path
          key={k}
          d={l.map((v, i) => `${i ? "L" : "M"}${x(i, l.length).toFixed(1)},${y(v).toFixed(1)}`).join("")}
          fill="none"
          stroke={COLORS[k]}
          strokeWidth={2}
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, delay: k * 0.1, ease: EASE }}
        />
      ))}
      {ends.map((e) => (
        <g key={e.k}>
          <circle cx={W - padR} cy={y(e.v)} r={3.5} fill={COLORS[e.k]} />
          <text x={W - padR + 8} y={e.y + 4} fontSize={11.5} fontWeight={600} fill={COLORS[e.k]}>{pctL(e.v)}</text>
        </g>
      ))}
    </svg>
  );
}

type Row = { l: Bi; v: (s: CompactStock) => React.ReactNode; best?: (s: CompactStock) => number | null; bar?: (s: CompactStock) => number | null; why?: (s: CompactStock) => Bi };
type Group = { t: Bi; rows: Row[] };

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

  const x2 = (v: number | null, d: number) => (v == null ? "–" : `${v.toLocaleString(lang === "id" ? "id-ID" : "en-US", { maximumFractionDigits: d, minimumFractionDigits: d })}×`);
  const groups: Group[] = [
    {
      t: { id: "Harga & momentum", en: "Price & momentum" },
      rows: [
        { l: { id: "Harga", en: "Price" }, v: (s) => price(s.price, lang) },
        { l: { id: "3 bulan", en: "3 months" }, v: (s) => <Signed v={ret3(s)} />, best: ret3, bar: ret3, why: (s) => ({ id: `naik paling tinggi 3 bulan (${pct(ret3(s), 1)})`, en: `the best 3-month run (${pct(ret3(s), 1)})` }) },
        { l: { id: "1 bulan", en: "1 month" }, v: (s) => <Signed v={s.ret_20} />, best: (s) => s.ret_20, bar: (s) => s.ret_20 },
        { l: { id: "Gerak normal harian", en: "Normal daily move" }, v: (s) => `±${pct(s.atr_pct, 1)}`, best: (s) => (s.atr_pct != null ? -s.atr_pct : null), why: (s) => ({ id: `paling tenang (±${pct(s.atr_pct, 1)} sehari)`, en: `the calmest (±${pct(s.atr_pct, 1)} a day)` }) },
        { l: { id: "Rentang wajar 1 bulan", en: "1-month range" }, v: (s) => (s.month ? `${price(s.month[0], lang)}–${price(s.month[1], lang)}` : "–") },
      ],
    },
    {
      t: { id: "Penilaian Arus", en: "Arus read" },
      rows: [
        { l: { id: "Peluang besok", en: "Next-day odds" }, v: (s) => <span style={{ color: VERDICT[verdictOf(s.q_1)].color }}>{tx(VERDICT[verdictOf(s.q_1)].label)}</span>, best: (s) => s.q_1, why: () => ({ id: "peluang besoknya paling tinggi", en: "the best next-day odds" }) },
      ],
    },
    {
      t: { id: "Kesehatan & pertumbuhan", en: "Health & growth" },
      rows: [
        { l: { id: "Kesehatan keuangan", en: "Financial health" }, v: (s) => (s.fin_grade ? <span className={FIN_GRADE[s.fin_grade].tone}>{tx(FIN_GRADE[s.fin_grade].label)} {s.fin_score}/{s.fin_n}</span> : "–"), best: (s) => (s.fin_n ? (s.fin_score ?? 0) / s.fin_n : null), why: (s) => ({ id: `keuangannya paling sehat (${s.fin_score}/${s.fin_n})`, en: `the healthiest books (${s.fin_score}/${s.fin_n})` }) },
        { l: { id: "Pendapatan / tahun", en: "Revenue / yr" }, v: (s) => <Signed v={s.rev_cagr} />, best: (s) => s.rev_cagr, bar: (s) => s.rev_cagr, why: (s) => ({ id: `pendapatan tumbuh paling cepat (${pct(s.rev_cagr, 1)}/thn)`, en: `the fastest revenue growth (${pct(s.rev_cagr, 1)}/yr)` }) },
        { l: { id: "ROE", en: "ROE" }, v: (s) => pct(s.roe_ttm, 1), best: (s) => s.roe_ttm, bar: (s) => s.roe_ttm, why: (s) => ({ id: `ROE tertinggi (${pct(s.roe_ttm, 1)})`, en: `the highest ROE (${pct(s.roe_ttm, 1)})` }) },
      ],
    },
    {
      t: { id: "Valuasi & dividen", en: "Valuation & dividend" },
      rows: [
        { l: { id: "PER", en: "P/E" }, v: (s) => x2(s.pe_ttm, 1), best: (s) => (s.pe_ttm != null && s.pe_ttm > 0 ? -s.pe_ttm : null), why: (s) => ({ id: `paling murah per laba (PER ${x2(s.pe_ttm, 1)})`, en: `the cheapest on earnings (P/E ${x2(s.pe_ttm, 1)})` }) },
        { l: { id: "PBV", en: "P/B" }, v: (s) => x2(s.pb_mrq, 2), best: (s) => (s.pb_mrq != null && s.pb_mrq > 0 ? -s.pb_mrq : null) },
        { l: { id: "Dividen", en: "Dividend" }, v: (s) => pct(s.yield_ttm, 1), best: (s) => s.yield_ttm, bar: (s) => s.yield_ttm, why: (s) => ({ id: `dividennya terbesar (${pct(s.yield_ttm, 1)})`, en: `the biggest dividend (${pct(s.yield_ttm, 1)})` }) },
        { l: { id: "Kapitalisasi", en: "Market cap" }, v: (s) => idr(s.market_cap, lang), bar: (s) => s.market_cap },
      ],
    },
    {
      t: { id: "Uang besar", en: "Big money" },
      rows: [
        { l: { id: "Asing sebulan", en: "Foreign, 1 mo" }, v: (s) => <span className={(s.ff_net_20 ?? 0) >= 0 ? "text-up" : "text-down"}>{idr(s.ff_net_20, lang)}</span>, best: (s) => s.ff_net_20, bar: (s) => s.ff_net_20, why: () => ({ id: "paling diminati asing sebulan ini", en: "the most favoured by foreigners this month" }) },
        {
          l: { id: "Arah broker 5 hari", en: "Broker tilt, 5 days" },
          v: (s) =>
            s.tilt5 == null ? "–" : s.tilt5 > 0.15 ? <span className="text-up">{tx({ id: "Akumulasi", en: "Accumulation" })}</span> : s.tilt5 < -0.15 ? <span className="text-down">{tx({ id: "Distribusi", en: "Distribution" })}</span> : tx({ id: "Seimbang", en: "Balanced" }),
          best: (s) => s.tilt5,
        },
      ],
    },
  ];

  // who wins which row, for the scoreboard and the plain-language takeaway
  const winners = new Map<string, Row[]>();
  for (const g of groups)
    for (const r of g.rows) {
      if (!r.best || items.length < 2) continue;
      const sc = items.map((s) => r.best!(s));
      const ok = sc.filter((v): v is number => v != null);
      if (ok.length < 2) continue;
      const w = items[sc.indexOf(Math.max(...ok))].symbol;
      winners.set(w, [...(winners.get(w) ?? []), r]);
    }
  const contested = groups.flatMap((g) => g.rows).filter((r) => r.best).length;
  const takeaway = items
    .map((s) => ({ s, rows: (winners.get(s.symbol) ?? []).filter((r) => r.why) }))
    .filter((x) => x.rows.length)
    .sort((a, b) => b.rows.length - a.rows.length)
    .map(({ s, rows }) => {
      const parts = rows.slice(0, 3).map((r) => tx(r.why!(s)));
      const join = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} ${tx({ id: "dan", en: "and" })} ${parts.at(-1)}` : parts[0];
      return { s: s.symbol, text: `${join}.` };
    });

  return (
    <div className="pt-7 sm:pt-9">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="max-w-3xl">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-balance sm:text-[2.4rem]">
          <T id="Bandingkan saham" en="Compare stocks" />
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-ink-2">
          <T id="Pilih 2 sampai 4 saham. Arus menuliskan siapa unggul di mana, lalu menjajarkan semua angkanya." en="Pick 2 to 4 stocks. Arus says who leads where, then lines up every number." />
        </p>
      </motion.header>

      <div className="mt-7 flex flex-wrap items-center gap-2">
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
          <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5">
              <div className="text-[12.5px] text-muted">{tx({ id: "Gerak harga 3 bulan, dari titik awal yang sama", en: "3-month price, rebased to the same start" })}</div>
              <div className="mt-2">
                <Chart items={items} />
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              {items.map((s, k) => {
                const won = winners.get(s.symbol)?.length ?? 0;
                const lead = won > 0 && won === Math.max(...items.map((x) => winners.get(x.symbol)?.length ?? 0));
                return (
                  <motion.div
                    key={s.symbol}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: k * 0.06, ease: EASE }}
                    className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3 ring-1 ring-line"
                    style={{ boxShadow: `inset 3px 0 0 ${COLORS[k]}` }}
                  >
                    <div className="min-w-0 flex-1">
                      <Link href={`/saham/${s.symbol}/`} className="flex items-center gap-1.5 text-[15px] font-semibold text-ink hover:text-arus">
                        {s.symbol}
                        {lead && <Crown size={14} className="text-warn" />}
                      </Link>
                      <div className="truncate text-[12px] text-muted">{(s.name ?? "").replace(/^PT\.? /, "")}</div>
                    </div>
                    <div className="text-right">
                      <div className="num text-[14px] text-ink">{price(s.price, lang)}</div>
                      <div className="text-[12px] text-muted">{tx({ id: `unggul di ${won}/${contested} ukuran`, en: `leads ${won}/${contested} measures` })}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>

          {takeaway.length > 0 && (
            <section className="mt-4 rounded-2xl bg-arus/5 p-4 ring-1 ring-arus/25 sm:p-5">
              <div className="text-[13px] font-semibold text-arus">{tx({ id: "Singkatnya", en: "In short" })}</div>
              <ul className="mt-2 space-y-1.5 text-[14px] leading-relaxed text-ink-2">
                {takeaway.map((t) => (
                  <li key={t.s}>
                    <span className="font-semibold" style={{ color: COLORS[items.findIndex((x) => x.symbol === t.s)] }}>{t.s}</span> {t.text}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-4 overflow-x-auto rounded-2xl bg-surface ring-1 ring-line">
            <table className="w-full min-w-[560px] border-separate border-spacing-0 text-[13px]">
              <thead>
                <tr>
                  <th className="w-44 px-4 py-2.5" />
                  {items.map((s, k) => (
                    <th key={s.symbol} className="px-4 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                        <span className="h-2 w-2 rounded-full" style={{ background: COLORS[k] }} />
                        {s.symbol}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.t.en}>
                  <tr>
                    <td colSpan={items.length + 1} className="border-t border-line bg-ground/40 px-4 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted">
                      {tx(g.t)}
                    </td>
                  </tr>
                  {g.rows.map((r) => {
                    const sc = r.best ? items.map((s) => r.best!(s)) : [];
                    const ok = sc.filter((v): v is number => v != null);
                    const bestIdx = ok.length > 1 ? sc.indexOf(Math.max(...ok)) : -1;
                    const bars = r.bar ? items.map((s) => r.bar!(s)) : null;
                    const maxBar = bars ? Math.max(...bars.map((v) => Math.abs(v ?? 0)), 1e-12) : 1;
                    return (
                      <tr key={r.l.en} className="hover:bg-raised/30">
                        <td className="border-t border-line px-4 py-2 text-[12.5px] text-muted">{tx(r.l)}</td>
                        {items.map((s, k) => (
                          <td key={s.symbol} className="num border-t border-line px-4 py-2 text-right text-ink">
                            <span className={`inline-flex items-center gap-1 ${k === bestIdx ? "font-semibold" : ""}`}>
                              {k === bestIdx && <Crown size={11} className="text-warn" />}
                              {r.v(s)}
                            </span>
                            {bars && bars[k] != null && (
                              <span className="mt-1 ml-auto block h-1 max-w-28 overflow-hidden rounded-full bg-raised">
                                <span className="block h-full rounded-full" style={{ width: `${(Math.abs(bars[k]!) / maxBar) * 100}%`, background: (bars[k] ?? 0) < 0 ? "#e66767" : COLORS[k], marginLeft: "auto" }} />
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </section>
          <p className="mt-3 text-[12px] text-muted">
            <T id="Mahkota = nilai terbaik di baris itu (PER/PBV: paling rendah selama positif; gerak harian: paling tenang). Ini perbandingan data, bukan rekomendasi." en="Crown = the best value in that row (P/E, P/B: lowest while positive; daily move: calmest). A data comparison, not a recommendation." />
          </p>
        </>
      )}
    </div>
  );
}

function Signed({ v }: { v: number | null | undefined }) {
  return <span className={v == null ? "text-muted" : v >= 0 ? "text-up" : "text-down"}>{v == null ? "–" : signed(v * 100, 1, "%")}</span>;
}

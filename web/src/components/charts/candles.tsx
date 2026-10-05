"use client";

import { scaleBand, scaleLinear } from "d3-scale";
import { line as d3line } from "d3-shape";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { C, useWidth } from "./kit";
import { Segmented } from "@/components/ui";
import { dateLabel, idr, price, signed } from "@/lib/format";
import { useLang, type Bi } from "@/lib/i18n";
import type { Candles } from "@/lib/types";
import { VERDICT, VERDICT_ORDER } from "@/lib/verdict";

type Level = { value: number; label: Bi; color: string };
export type Cone = { steps: number; lo: number; mid: number; hi: number }[];

const RANGES: { key: string; n: number; label: Bi }[] = [
  { key: "1m", n: 21, label: { id: "1B", en: "1M" } },
  { key: "3m", n: 63, label: { id: "3B", en: "3M" } },
  { key: "6m", n: 126, label: { id: "6B", en: "6M" } },
  { key: "1y", n: 9999, label: { id: "1T", en: "1Y" } },
];

type Toggle = "ma20" | "ma50" | "vp" | "ihsg" | "arus" | "cone";
const TOGGLES: { key: Toggle; label: Bi; color: string }[] = [
  { key: "arus", label: { id: "Riwayat skor", en: "Score history" }, color: "#5cc8ff" },
  { key: "cone", label: { id: "Rentang wajar", en: "Typical range" }, color: "#5cc8ff" },
  { key: "ma20", label: { id: "MA20", en: "MA20" }, color: "#fab219" },
  { key: "ma50", label: { id: "MA50", en: "MA50" }, color: "#e87ba4" },
  { key: "vp", label: { id: "Profil volume", en: "Volume profile" }, color: "#9085e9" },
  { key: "ihsg", label: { id: "vs IHSG", en: "vs IHSG" }, color: "#aab5c7" },
];

const VCODE = ["caution", "weak", "neutral", "edge", "strong"] as const;

function sma(arr: number[], n: number) {
  return arr.map((_, i) => (i + 1 < n ? null : arr.slice(i + 1 - n, i + 1).reduce((a, b) => a + b, 0) / n));
}

/**
 * Price, volume and foreign-flow panes on one crosshair, plus what no charting tool has:
 * the trail of what Arus said on each past day and what happened next, and a forecast
 * cone whose width was checked against history.
 */
export function CandleChart({
  data,
  levels = [],
  ihsg,
  horizon,
  cone,
  height = 500,
}: {
  data: Candles;
  levels?: Level[];
  ihsg?: { date: string; v: number | null }[];
  horizon: 1 | 20;
  cone?: Cone;
  height?: number;
}) {
  const { tx, lang } = useLang();
  const [ref, w] = useWidth<HTMLDivElement>();
  const [range, setRange] = useState("3m");
  const [on, setOn] = useState<Record<Toggle, boolean>>({ arus: true, cone: true, ma20: false, ma50: false, vp: false, ihsg: false });
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const flip = (k: Toggle) => setOn((s) => ({ ...s, [k]: !s[k] }));

  const all = useMemo(
    () =>
      data.date.map((d, i) => ({
        d,
        o: data.o[i] ?? data.c[i],
        h: data.h[i] ?? data.c[i],
        l: data.l[i] ?? data.c[i],
        c: data.c[i],
        v: data.v[i] ?? 0,
        f: data.f[i] ?? 0,
        verdict: (horizon === 1 ? data.v1 : data.v20)?.[i] ?? null,
      })),
    [data, horizon],
  );
  const ma20All = useMemo(() => sma(all.map((r) => r.c), 20), [all]);
  const ma50All = useMemo(() => sma(all.map((r) => r.c), 50), [all]);
  const n = RANGES.find((r) => r.key === range)!.n;
  const start = Math.max(0, all.length - n);
  const rows = all.slice(start);
  const ma20 = ma20All.slice(start);
  const ma50 = ma50All.slice(start);

  const ihsgMap = useMemo(() => new Map((ihsg ?? []).map((p) => [p.date, p.v])), [ihsg]);
  const ihsgRows = rows.map((r) => ihsgMap.get(r.d) ?? null);
  const ihsgBase = ihsgRows.find((v) => v != null) ?? null;
  const ihsgRebased = ihsgRows.map((v) => (v != null && ihsgBase ? (v / ihsgBase) * rows[0].c : null));

  const coneSteps = on.cone && cone?.length ? cone[cone.length - 1].steps : 0;
  const axisW = 58;
  const strip = on.arus ? 18 : 0;
  const pH = Math.round(height * 0.58);
  const vH = Math.round(height * 0.12);
  const gap = 8;
  const fH = height - pH - vH - strip - 34 - (strip ? gap : 0);
  const plotW = Math.max(10, w - axisW);
  const slots = rows.length + coneSteps;
  const x = scaleBand<number>().domain(Array.from({ length: slots }, (_, i) => i)).range([0, plotW]).paddingInner(slots > 90 ? 0.18 : 0.3);

  const visLevels = levels.filter((lv) => Number.isFinite(lv.value));
  const extra = [
    ...(on.ma20 ? (ma20.filter((v) => v != null) as number[]) : []),
    ...(on.ma50 ? (ma50.filter((v) => v != null) as number[]) : []),
    ...(on.ihsg ? (ihsgRebased.filter((v) => v != null) as number[]) : []),
    ...(coneSteps ? cone!.flatMap((c) => [c.lo, c.hi]) : []),
  ];
  const lows = rows.map((r) => r.l);
  const highs = rows.map((r) => r.h);
  const lo = Math.min(...lows, ...extra, ...visLevels.map((l) => l.value).filter((v) => v > Math.min(...lows) * 0.85));
  const hi = Math.max(...highs, ...extra, ...visLevels.map((l) => l.value).filter((v) => v < Math.max(...highs) * 1.15));
  const padY = (hi - lo) * 0.06 || hi * 0.02;
  const yP = scaleLinear().domain([lo - padY, hi + padY]).range([pH, 8]).nice(5);
  const stripTop = pH + gap;
  const vTop = stripTop + strip + (strip ? gap : 0);
  const yV = scaleLinear().domain([0, Math.max(...rows.map((r) => r.v), 1)]).range([vTop + vH, vTop + 4]);
  const fExt = Math.max(...rows.map((r) => Math.abs(r.f)), 1);
  const fTop = vTop + vH + gap + 14;
  const yF = scaleLinear().domain([-fExt, fExt]).range([fTop + fH, fTop]);
  const cx = (i: number) => x(i)! + x.bandwidth() / 2;

  // volume profile: traded volume per price bucket over the visible window
  const vp = (() => {
    if (!on.vp) return null;
    const bins = 24;
    const [a, b] = yP.domain();
    const step = (b - a) / bins;
    const acc = new Array(bins).fill(0);
    rows.forEach((r) => {
      const typ = (r.h + r.l + r.c) / 3;
      const k = Math.min(bins - 1, Math.max(0, Math.floor((typ - a) / step)));
      acc[k] += r.v;
    });
    const max = Math.max(...acc, 1);
    const poc = acc.indexOf(max);
    return { acc, step, a, max, poc };
  })();

  const cur = hover != null && hover < rows.length ? rows[hover] : rows[rows.length - 1];
  const curIdx = hover != null && hover < rows.length ? hover : rows.length - 1;
  const prevC = curIdx > 0 ? rows[curIdx - 1].c : cur?.c;
  const chg = cur && prevC ? cur.c / prevC - 1 : 0;

  // what happened `horizon` sessions after the hovered day
  const outcome = (() => {
    if (hover == null || hover >= rows.length) return null;
    const gi = start + hover;
    const later = all[gi + horizon];
    if (!later) return null;
    const ret = later.c / all[gi].c - 1;
    const i0 = ihsgMap.get(all[gi].d);
    const i1 = ihsgMap.get(later.d);
    const rel = i0 && i1 ? ret - (i1 / i0 - 1) : null;
    return { ret, rel };
  })();

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - rect.left) / (plotW / slots));
    setHover(i >= 0 && i < rows.length ? i : null);
  };

  const monthTicks = rows
    .map((r, i) => ({ i, d: r.d }))
    .filter((t, k, arr) => k === 0 || t.d.slice(0, 7) !== arr[k - 1].d.slice(0, 7))
    .filter((_, k, arr) => arr.length <= 8 || k % 2 === 0);

  const linePath = (vals: (number | null)[]) =>
    d3line<number | null>()
      .defined((v) => v != null)
      .x((_, i) => cx(i))
      .y((v) => yP(v as number))(vals) ?? "";

  const last = rows.length - 1;
  const pinIdx = pinned ? rows.findIndex((r) => r.d === pinned) : -1;
  const hv = hover != null ? rows[hover]?.verdict : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {cur && (
          <div className="num flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px] text-muted">
            <span className="text-ink-2">{dateLabel(cur.d, lang)}</span>
            <span>O <span className="text-ink">{price(cur.o, lang)}</span></span>
            <span>H <span className="text-ink">{price(cur.h, lang)}</span></span>
            <span>L <span className="text-ink">{price(cur.l, lang)}</span></span>
            <span>C <span className="text-ink">{price(cur.c, lang)}</span></span>
            <span className={chg >= 0 ? "text-up" : "text-down"}>{signed(chg * 100, 2, "%")}</span>
          </div>
        )}
        <Segmented label={tx({ id: "Rentang waktu", en: "Time range" })} value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.key, label: tx(r.label) }))} />
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label={tx({ id: "Lapisan grafik", en: "Chart layers" })}>
        {TOGGLES.map((t) => (
          <button
            key={t.key}
            onClick={() => flip(t.key)}
            aria-pressed={on[t.key]}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] ring-1 transition-colors duration-150 ${
              on[t.key] ? "bg-raised text-ink ring-line-strong" : "text-muted ring-line hover:text-ink-2"
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: on[t.key] ? t.color : "transparent", boxShadow: `inset 0 0 0 1.5px ${t.color}` }} />
            {tx(t.label)}
          </button>
        ))}
      </div>

      <div ref={ref} className="relative w-full select-none" style={{ height }}>
        {w > 0 && rows.length > 1 && (
          <svg
            width={w}
            height={height}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            onClick={() => hover != null && setPinned((p) => (p === rows[hover].d ? null : rows[hover].d))}
            className="cursor-pointer touch-none"
          >
            {pinIdx >= 0 && <rect x={x(pinIdx)! - x.step() * 0.15} y={0} width={x.step()} height={fTop + fH} fill="#5cc8ff" fillOpacity={0.08} stroke="#5cc8ff" strokeOpacity={0.35} />}
            {yP.ticks(5).map((t) => {
              const yy = yP(t);
              const clash = visLevels.some((lv) => Math.abs(yP(lv.value) - yy) < 14) || Math.abs(yP(rows[last].c) - yy) < 14 || (hover != null && Math.abs(yP(rows[hover].c) - yy) < 14);
              return (
                <g key={t}>
                  <line x1={0} x2={plotW} y1={yy} y2={yy} stroke={C.grid} />
                  {!clash && (
                    <text x={plotW + 8} y={yy} dy="0.32em" fontSize={11} fill={C.muted} className="num">
                      {price(t, lang)}
                    </text>
                  )}
                </g>
              );
            })}

            {vp && (
              <g pointerEvents="none">
                {vp.acc.map((v, k) => {
                  const y0 = yP(vp.a + (k + 1) * vp.step);
                  const y1 = yP(vp.a + k * vp.step);
                  const bw = (v / vp.max) * plotW * 0.28;
                  return <rect key={k} x={plotW - bw} y={y0 + 1} width={bw} height={Math.max(1, y1 - y0 - 2)} fill="#9085e9" fillOpacity={k === vp.poc ? 0.45 : 0.18} rx={2} />;
                })}
              </g>
            )}

            {monthTicks.map((t) => (
              <text key={t.d} x={x(t.i)} y={height - 4} fontSize={10.5} fill={C.muted}>
                {dateLabel(t.d, lang, { day: undefined, year: rows.length > 130 ? "2-digit" : undefined, month: "short" })}
              </text>
            ))}

            {visLevels.map((lv) => {
              const yy = yP(lv.value);
              if (yy < 4 || yy > pH) return null;
              const nearLast = Math.abs(yP(rows[last].c) - yy) < 14;
              return (
                <g key={lv.label.en}>
                  <line x1={0} x2={plotW} y1={yy} y2={yy} stroke={lv.color} strokeDasharray="5 5" strokeOpacity={0.7} />
                  {!nearLast && (
                    <>
                      <rect x={plotW + 2} y={yy - 9} width={axisW - 4} height={18} rx={4} fill={lv.color} fillOpacity={0.18} />
                      <text x={plotW + 6} y={yy} dy="0.32em" fontSize={10.5} fill={lv.color} className="num">
                        {price(lv.value, lang)}
                      </text>
                    </>
                  )}
                  <text x={6} y={yy - 5} fontSize={10.5} fill={lv.color}>
                    {tx(lv.label)}
                  </text>
                </g>
              );
            })}

            {coneSteps > 0 && (
              <g pointerEvents="none">
                <motion.path
                  d={`M ${cx(last)} ${yP(rows[last].c)} ${cone!.map((c) => `L ${cx(last + c.steps)} ${yP(c.hi)}`).join(" ")} ${[...cone!].reverse().map((c) => `L ${cx(last + c.steps)} ${yP(c.lo)}`).join(" ")} Z`}
                  fill="#5cc8ff"
                  fillOpacity={0.1}
                  stroke="#5cc8ff"
                  strokeOpacity={0.35}
                  strokeDasharray="3 3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6 }}
                />
                <path d={`M ${cx(last)} ${yP(rows[last].c)} ${cone!.map((c) => `L ${cx(last + c.steps)} ${yP(c.mid)}`).join(" ")}`} fill="none" stroke="#5cc8ff" strokeWidth={1.5} strokeDasharray="2 3" />
                <text x={cx(last + coneSteps)} y={yP(cone![cone!.length - 1].hi) - 6} fontSize={10.5} fill="#5cc8ff" textAnchor="end">
                  {tx({ id: "rentang wajar", en: "typical range" })}
                </text>
              </g>
            )}

            {rows.map((r, i) => {
              const up = r.c >= r.o;
              const col = up ? C.up : C.down;
              const xx = x(i)!;
              const bw = x.bandwidth();
              const top = yP(Math.max(r.o, r.c));
              const bh = Math.max(1, Math.abs(yP(r.o) - yP(r.c)));
              return (
                <g key={r.d} opacity={hover == null || hover === i ? 1 : 0.55}>
                  <line x1={xx + bw / 2} x2={xx + bw / 2} y1={yP(r.h)} y2={yP(r.l)} stroke={col} strokeWidth={1} />
                  <rect x={xx} y={top} width={Math.max(1, bw)} height={bh} fill={col} fillOpacity={0.9} rx={Math.min(1.5, bw / 3)} />
                  {on.arus && r.verdict != null && <rect x={xx} y={stripTop} width={Math.max(1, x.step())} height={strip} fill={VERDICT[VCODE[r.verdict]].color} fillOpacity={hover == null || hover === i ? 0.85 : 0.45} />}
                  <rect x={xx} y={yV(r.v)} width={Math.max(1, bw)} height={Math.max(0.5, yV(0) - yV(r.v))} fill={col} fillOpacity={0.35} />
                  <rect x={xx} y={Math.min(yF(0), yF(r.f))} width={Math.max(1, bw)} height={Math.max(0.5, Math.abs(yF(r.f) - yF(0)))} fill={r.f >= 0 ? C.up : C.down} fillOpacity={0.85} />
                </g>
              );
            })}

            {on.ma20 && <path d={linePath(ma20)} fill="none" stroke="#fab219" strokeWidth={1.5} />}
            {on.ma50 && <path d={linePath(ma50)} fill="none" stroke="#e87ba4" strokeWidth={1.5} />}
            {on.ihsg && <path d={linePath(ihsgRebased)} fill="none" stroke="#aab5c7" strokeWidth={1.5} strokeDasharray="4 3" />}

            {hover == null && (
              <g pointerEvents="none">
                <rect x={plotW + 2} y={yP(rows[last].c) - 9} width={axisW - 4} height={18} rx={4} fill={rows[last].c >= rows[last].o ? C.up : C.down} />
                <text x={plotW + 6} y={yP(rows[last].c)} dy="0.32em" fontSize={10.5} fill="#fff" className="num">
                  {price(rows[last].c, lang)}
                </text>
              </g>
            )}

            {on.arus && (
              <text x={4} y={stripTop - 3} fontSize={10.5} fill={C.muted}>
                {tx({ id: "Penilaian Arus untuk esok harinya, dibuat setiap hari", en: "Arus' call for the next day, made every day" })}
              </text>
            )}
            <text x={4} y={vTop + 12} fontSize={10.5} fill={C.muted}>
              Volume
            </text>
            <line x1={0} x2={plotW} y1={yF(0)} y2={yF(0)} stroke={C.axis} />
            <text x={4} y={fTop - 2} fontSize={10.5} fill={C.muted}>
              {tx({ id: "Dana asing (biru beli · merah jual)", en: "Foreign flow (blue buy · red sell)" })}
            </text>

            {hover != null && (
              <g pointerEvents="none">
                <line x1={cx(hover)} x2={cx(hover)} y1={4} y2={fTop + fH} stroke={C.axis} strokeDasharray="3 3" />
                <line x1={0} x2={plotW} y1={yP(rows[hover].c)} y2={yP(rows[hover].c)} stroke={C.axis} strokeDasharray="3 3" />
                <rect x={plotW + 2} y={yP(rows[hover].c) - 9} width={axisW - 4} height={18} rx={4} fill="#e9eef6" />
                <text x={plotW + 6} y={yP(rows[hover].c)} dy="0.32em" fontSize={10.5} fill="#070b14" className="num">
                  {price(rows[hover].c, lang)}
                </text>
              </g>
            )}
          </svg>
        )}

        {hover != null && rows[hover] && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute z-20 min-w-48 rounded-lg border border-line-strong bg-raised/95 px-3 py-2 text-[12px] text-ink-2 shadow-[0_10px_30px_-8px_rgb(0_0_0/0.7)] backdrop-blur-md"
            style={{ left: cx(hover) > plotW / 2 ? 8 : Math.max(8, plotW - 230), top: 8 }}
          >
            {hv != null && on.arus && (
              <div className="mb-1">
                {tx({ id: "Arus saat itu:", en: "Arus then:" })} <span className="font-semibold" style={{ color: VERDICT[VCODE[hv]].color }}>{tx(VERDICT[VCODE[hv]].label)}</span>
              </div>
            )}
            {outcome && (
              <div className="num">
                {tx({ id: `${horizon} hari bursa kemudian:`, en: `${horizon} sessions later:` })}{" "}
                <span className={outcome.ret >= 0 ? "text-up" : "text-down"}>{signed(outcome.ret * 100, 1, "%")}</span>
                {outcome.rel != null && (
                  <span className="text-muted">
                    {" "}
                    ({signed(outcome.rel * 100, 1, "%")} vs IHSG)
                  </span>
                )}
              </div>
            )}
            <div className="num text-muted">
              {tx({ id: "Asing", en: "Foreign" })} <span className={rows[hover].f >= 0 ? "text-up" : "text-down"}>{idr(rows[hover].f, lang)}</span>
            </div>
          </motion.div>
        )}
      </div>
      {on.arus && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
          <span>{tx({ id: "Pita warna = penilaian Arus tiap hari. Klik satu hari untuk melihat detailnya dan apa yang terjadi sesudahnya.", en: "Colour strip = Arus' call each day. Click a day to see its details and what happened next." })}</span>
          {VERDICT_ORDER.slice().reverse().map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className="h-2 w-3 rounded-sm" style={{ background: VERDICT[k].color }} />
              {tx(VERDICT[k].short)}
            </span>
          ))}
          <span>· {tx({ id: "arahkan kursor untuk melihat apa yang terjadi sesudahnya", en: "hover to see what happened next" })}</span>
        </div>
      )}
      {pinned && <DayPanel all={all} date={pinned} ihsgMap={ihsgMap} onClose={() => setPinned(null)} onStep={setPinned} />}
    </div>
  );
}


type Row = { d: string; o: number; h: number; l: number; c: number; v: number; f: number; verdict: number | null };

/** One clicked day as a small story: the candle's range, how busy it was, who bought, what Arus said, what followed. */
function DayPanel({ all, date, ihsgMap, onClose, onStep }: { all: Row[]; date: string; ihsgMap: Map<string, number | null>; onClose: () => void; onStep: (d: string) => void }) {
  const { tx, lang } = useLang();
  const i = all.findIndex((r) => r.d === date);
  if (i < 0) return null;
  const r = all[i];
  const prev = i > 0 ? all[i - 1].c : null;
  const chg = prev ? r.c / prev - 1 : null;
  const avgV = all.slice(Math.max(0, i - 20), i).reduce((a, b) => a + b.v, 0) / Math.max(1, Math.min(20, i));
  const vMult = avgV ? r.v / avgV : null;
  const after = (k: number) => {
    const later = all[i + k];
    if (!later) return null;
    const ret = later.c / r.c - 1;
    const a = ihsgMap.get(r.d);
    const b = ihsgMap.get(later.d);
    return { ret, rel: a && b ? ret - (b / a - 1) : null };
  };
  const outcomes = [
    { k: 1, l: { id: "Besok", en: "Next day" }, v: after(1) },
    { k: 5, l: { id: "5 hari", en: "5 days" }, v: after(5) },
  ];
  const v = r.verdict != null ? VERDICT[VCODE[r.verdict]] : null;
  const span = r.h - r.l || 1;
  const pos = (x: number) => `${((x - r.l) / span) * 100}%`;
  const up = r.c >= r.o;
  const fAbsMax = Math.max(...all.slice(Math.max(0, i - 60), i + 1).map((x) => Math.abs(x.f)), 1);

  return (
    <motion.div key={date} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="mt-4 overflow-hidden rounded-2xl bg-raised/50 ring-1 ring-line-strong">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-1">
          <button disabled={i === 0} onClick={() => onStep(all[i - 1].d)} aria-label={tx({ id: "Hari sebelumnya", en: "Previous day" })} className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-[16px] text-muted ring-1 ring-line hover:text-ink disabled:cursor-not-allowed disabled:opacity-30">
            ‹
          </button>
          <button disabled={i >= all.length - 1} onClick={() => onStep(all[i + 1].d)} aria-label={tx({ id: "Hari berikutnya", en: "Next day" })} className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-[16px] text-muted ring-1 ring-line hover:text-ink disabled:cursor-not-allowed disabled:opacity-30">
            ›
          </button>
          <span className="ml-2 text-[13.5px] font-semibold text-ink">{dateLabel(r.d, lang, { weekday: "long" })}</span>
        </div>
        <button onClick={onClose} className="cursor-pointer rounded-md px-2 py-1 text-[12px] text-muted hover:text-ink">
          {tx({ id: "Tutup", en: "Close" })} ✕
        </button>
      </div>

      <div className="grid gap-px bg-line md:grid-cols-[1.2fr_1fr_1fr]">
        <div className="bg-surface p-4">
          <div className="flex items-baseline gap-2">
            <span className="num text-2xl font-semibold text-ink">{price(r.c, lang)}</span>
            {chg != null && (
              <span className={`num rounded-md px-1.5 py-0.5 text-[12.5px] font-medium ${chg >= 0 ? "bg-up/15 text-[#9cc5f5]" : "bg-down/15 text-[#f0a3a3]"}`}>{signed(chg * 100, 2, "%")}</span>
            )}
          </div>
          <div className="mt-4">
            <div className="relative h-2 rounded-full bg-raised">
              <div className="absolute inset-y-0 rounded-full" style={{ left: pos(Math.min(r.o, r.c)), width: `${(Math.abs(r.c - r.o) / span) * 100}%`, background: up ? C.up : C.down, minWidth: 3 }} />
              <span className="absolute -top-1 h-4 w-0.5 rounded bg-ink" style={{ left: pos(r.c) }} />
            </div>
            <div className="num mt-1.5 flex justify-between text-[11.5px] text-muted">
              <span>
                {tx({ id: "Terendah", en: "Low" })} {price(r.l, lang)}
              </span>
              <span>
                {tx({ id: "Tertinggi", en: "High" })} {price(r.h, lang)}
              </span>
            </div>
            <div className="num mt-1 text-[11.5px] text-muted">
              {tx({ id: "Buka", en: "Open" })} {price(r.o, lang)} → {tx({ id: "tutup", en: "close" })} {price(r.c, lang)} · {tx({ id: "rentang", en: "range" })} {((span / r.l) * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="space-y-4 bg-surface p-4">
          <div>
            <div className="flex justify-between text-[12px]">
              <span className="text-muted">Volume</span>
              <span className="num text-ink">
                {(r.v / 1e6).toFixed(1)} {tx({ id: "jt", en: "M" })}
                {vMult != null && <span className={`ml-1.5 ${vMult >= 1.5 ? "text-warn" : "text-muted"}`}>{vMult.toFixed(1)}×</span>}
              </span>
            </div>
            <div className="relative mt-1.5 h-2 rounded-full bg-raised">
              <div className="h-2 rounded-full bg-[#9085e9]" style={{ width: `${Math.min(100, ((vMult ?? 0) / 3) * 100)}%` }} />
              <span className="absolute -top-0.5 h-3 w-px bg-ink-2" style={{ left: "33.3%" }} />
            </div>
            <div className="mt-1 text-[11px] text-muted">{tx({ id: "garis tipis = rata-rata 20 hari", en: "tick = 20-day average" })}</div>
          </div>
          <div>
            <div className="flex justify-between text-[12px]">
              <span className="text-muted">{tx({ id: "Dana asing", en: "Foreign money" })}</span>
              <span className={`num ${r.f >= 0 ? "text-up" : "text-down"}`}>
                {r.f >= 0 ? tx({ id: "beli", en: "bought" }) : tx({ id: "jual", en: "sold" })} {idr(Math.abs(r.f), lang)}
              </span>
            </div>
            <div className="relative mt-1.5 h-2 rounded-full bg-raised">
              <span className="absolute left-1/2 top-0 h-2 w-px bg-line-strong" />
              <div
                className="absolute inset-y-0 rounded-full"
                style={{ background: r.f >= 0 ? C.up : C.down, left: r.f >= 0 ? "50%" : `${50 - (Math.abs(r.f) / fAbsMax) * 50}%`, width: `${(Math.abs(r.f) / fAbsMax) * 50}%` }}
              />
            </div>
            <div className="mt-1 text-[11px] text-muted">{tx({ id: "dibanding hari tersibuk 3 bulan", en: "vs the busiest day in 3 months" })}</div>
          </div>
        </div>

        <div className="bg-surface p-4">
          <div className="text-[12px] text-muted">{tx({ id: "Penilaian Arus hari itu", en: "Arus call that day" })}</div>
          <div className="mt-1 text-[16px] font-semibold" style={{ color: v?.color }}>
            {v ? tx(v.label) : "–"}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {outcomes.map((o) => (
              <div key={o.k} className="rounded-lg bg-ground/60 p-2.5 ring-1 ring-line">
                <div className="text-[11px] text-muted">{tx(o.l)}</div>
                <div className={`num text-[17px] font-semibold ${o.v == null ? "text-muted" : o.v.ret >= 0 ? "text-up" : "text-down"}`}>{o.v ? signed(o.v.ret * 100, 1, "%") : "–"}</div>
                {o.v?.rel != null && <div className="num text-[10.5px] text-muted">{signed(o.v.rel * 100, 1, "%")} vs IHSG</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

"use client";

import { scaleBand, scaleLinear } from "d3-scale";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { C, useWidth } from "./kit";
import { Segmented } from "@/components/ui";
import { dateLabel, idr, price, signed } from "@/lib/format";
import { useLang, type Bi } from "@/lib/i18n";
import type { Candles } from "@/lib/types";

type Level = { value: number; label: Bi; color: string };

const RANGES: { key: string; n: number; label: Bi }[] = [
  { key: "1m", n: 21, label: { id: "1B", en: "1M" } },
  { key: "3m", n: 63, label: { id: "3B", en: "3M" } },
  { key: "6m", n: 126, label: { id: "6B", en: "6M" } },
  { key: "1y", n: 9999, label: { id: "1T", en: "1Y" } },
];

/** TradingView-style chart: candles, volume and foreign-flow panes on one synced crosshair. */
export function CandleChart({ data, levels = [], height = 460 }: { data: Candles; levels?: Level[]; height?: number }) {
  const { tx, lang } = useLang();
  const [ref, w] = useWidth<HTMLDivElement>();
  const [range, setRange] = useState("3m");
  const [hover, setHover] = useState<number | null>(null);

  const n = RANGES.find((r) => r.key === range)!.n;
  const rows = useMemo(() => {
    const all = data.date.map((d, i) => ({ d, o: data.o[i] ?? data.c[i], h: data.h[i] ?? data.c[i], l: data.l[i] ?? data.c[i], c: data.c[i], v: data.v[i] ?? 0, f: data.f[i] ?? 0 }));
    return all.slice(-n);
  }, [data, n]);

  const axisW = 58;
  const pH = Math.round(height * 0.62);
  const vH = Math.round(height * 0.14);
  const fH = height - pH - vH - 28;
  const gap = 8;
  const plotW = Math.max(10, w - axisW);

  const x = scaleBand<number>().domain(rows.map((_, i) => i)).range([0, plotW]).paddingInner(rows.length > 90 ? 0.18 : 0.3);
  const lows = rows.map((r) => r.l);
  const highs = rows.map((r) => r.h);
  const visLevels = levels.filter((lv) => Number.isFinite(lv.value));
  const lo = Math.min(...lows, ...visLevels.map((l) => l.value).filter((v) => v > Math.min(...lows) * 0.85));
  const hi = Math.max(...highs, ...visLevels.map((l) => l.value).filter((v) => v < Math.max(...highs) * 1.15));
  const pad = (hi - lo) * 0.06 || hi * 0.02;
  const yP = scaleLinear().domain([lo - pad, hi + pad]).range([pH, 8]).nice(5);
  const yV = scaleLinear().domain([0, Math.max(...rows.map((r) => r.v), 1)]).range([pH + gap + vH, pH + gap + 4]);
  const fExt = Math.max(...rows.map((r) => Math.abs(r.f)), 1);
  const fTop = pH + gap + vH + gap + 14;
  const yF = scaleLinear().domain([-fExt, fExt]).range([fTop + fH, fTop]);

  const cur = hover != null ? rows[hover] : rows[rows.length - 1];
  const prevC = hover != null && hover > 0 ? rows[hover - 1].c : rows.length > 1 ? rows[rows.length - 2].c : cur?.c;
  const chg = cur && prevC ? cur.c / prevC - 1 : 0;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.floor(px / (plotW / rows.length));
    setHover(i >= 0 && i < rows.length ? i : null);
  };

  const monthTicks = rows
    .map((r, i) => ({ i, d: r.d }))
    .filter((t, k, arr) => k === 0 || t.d.slice(0, 7) !== arr[k - 1].d.slice(0, 7))
    .filter((_, k, arr) => arr.length <= 8 || k % 2 === 0);

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
      <div ref={ref} className="relative w-full select-none" style={{ height }}>
        {w > 0 && rows.length > 1 && (
          <svg width={w} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="touch-none">
            {yP.ticks(5).map((t) => (
              <g key={t}>
                <line x1={0} x2={plotW} y1={yP(t)} y2={yP(t)} stroke={C.grid} />
                <text x={plotW + 8} y={yP(t)} dy="0.32em" fontSize={11} fill={C.muted} className="num">{price(t, lang)}</text>
              </g>
            ))}
            {monthTicks.map((t) => (
              <text key={t.d} x={x(t.i)} y={height - 4} fontSize={10.5} fill={C.muted}>
                {dateLabel(t.d, lang, { day: undefined, year: rows.length > 130 ? "2-digit" : undefined, month: "short" })}
              </text>
            ))}

            {visLevels.map((lv) => {
              const yy = yP(lv.value);
              if (yy < 4 || yy > pH) return null;
              return (
                <g key={lv.label.en}>
                  <line x1={0} x2={plotW} y1={yy} y2={yy} stroke={lv.color} strokeDasharray="5 5" strokeOpacity={0.75} />
                  <rect x={plotW + 2} y={yy - 9} width={axisW - 4} height={18} rx={4} fill={lv.color} fillOpacity={0.18} />
                  <text x={plotW + 6} y={yy} dy="0.32em" fontSize={10.5} fill={lv.color} className="num">{price(lv.value, lang)}</text>
                  <text x={6} y={yy - 5} fontSize={10.5} fill={lv.color}>{tx(lv.label)}</text>
                </g>
              );
            })}

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
                  <rect x={xx} y={top} width={Math.max(1, bw)} height={bh} fill={up ? col : col} fillOpacity={up ? 0.9 : 0.9} rx={Math.min(1.5, bw / 3)} />
                  <rect x={xx} y={yV(r.v)} width={Math.max(1, bw)} height={Math.max(0.5, yV(0) - yV(r.v))} fill={col} fillOpacity={0.35} />
                  <rect
                    x={xx}
                    y={Math.min(yF(0), yF(r.f))}
                    width={Math.max(1, bw)}
                    height={Math.max(0.5, Math.abs(yF(r.f) - yF(0)))}
                    fill={r.f >= 0 ? C.up : C.down}
                    fillOpacity={0.85}
                  />
                </g>
              );
            })}

            <text x={4} y={pH + gap + 14} fontSize={10.5} fill={C.muted}>Volume</text>
            <line x1={0} x2={plotW} y1={yF(0)} y2={yF(0)} stroke={C.axis} />
            <text x={4} y={fTop - 2} fontSize={10.5} fill={C.muted}>
              {tx({ id: "Dana asing (biru beli · merah jual)", en: "Foreign flow (blue buy · red sell)" })}
            </text>

            {hover != null && (
              <g pointerEvents="none">
                <line x1={x(hover)! + x.bandwidth() / 2} x2={x(hover)! + x.bandwidth() / 2} y1={4} y2={fTop + fH} stroke={C.axis} strokeDasharray="3 3" />
                <line x1={0} x2={plotW} y1={yP(rows[hover].c)} y2={yP(rows[hover].c)} stroke={C.axis} strokeDasharray="3 3" />
                <rect x={plotW + 2} y={yP(rows[hover].c) - 9} width={axisW - 4} height={18} rx={4} fill="#e9eef6" />
                <text x={plotW + 6} y={yP(rows[hover].c)} dy="0.32em" fontSize={10.5} fill="#070b14" className="num">{price(rows[hover].c, lang)}</text>
              </g>
            )}
          </svg>
        )}
        {hover != null && rows[hover] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pointer-events-none absolute left-2 rounded-md bg-raised/90 px-2 py-1 text-[11px] text-ink-2 ring-1 ring-line backdrop-blur"
            style={{ top: fTop + fH - 34 }}
          >
            <span className="num">{tx({ id: "Asing", en: "Foreign" })} <span className={rows[hover].f >= 0 ? "text-up" : "text-down"}>{idr(rows[hover].f, lang)}</span></span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

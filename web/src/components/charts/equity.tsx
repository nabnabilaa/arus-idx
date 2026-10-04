"use client";

import { scaleLinear, scalePoint } from "d3-scale";
import { line as d3line, curveMonotoneX } from "d3-shape";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { C, Tooltip, useWidth } from "./kit";
import { dateLabel, signed } from "@/lib/format";
import { useLang, type Bi } from "@/lib/i18n";

type Equity = { dates: string[]; top: number[]; bottom: number[]; all: number[]; top_net: number[] };

const SERIES: { key: keyof Omit<Equity, "dates">; label: Bi; color: string; dash?: string; width: number }[] = [
  { key: "top", label: { id: "Sangat diunggulkan", en: "Strong edge" }, color: "#5cc8ff", width: 2.5 },
  { key: "top_net", label: { id: "…setelah biaya transaksi", en: "…after trading costs" }, color: "#5cc8ff", dash: "5 4", width: 1.5 },
  { key: "all", label: { id: "Semua saham (rata-rata)", en: "All stocks (average)" }, color: "#aab5c7", width: 1.5 },
  { key: "bottom", label: { id: "Waspada", en: "Caution" }, color: "#e66767", width: 2.5 },
];

/** "If you had followed Arus": cumulative excess return vs IHSG, IHSG = the zero line. */
export function EquityChart({ data, height = 340 }: { data: Equity; height?: number }) {
  const { tx, lang } = useLang();
  const reduce = useReducedMotion();
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 8, r: 150, t: 12, b: 26 };
  const n = data.dates.length;
  const x = scalePoint<number>().domain(data.dates.map((_, i) => i)).range([pad.l, Math.max(pad.l + 1, w - pad.r)]);
  const vals = SERIES.flatMap((s) => data[s.key]);
  const lo = Math.min(0, ...vals);
  const hi = Math.max(0, ...vals);
  const y = scaleLinear().domain([lo - 0.01, hi + 0.01]).range([height - pad.b, pad.t]).nice(5);
  const path = (k: keyof Omit<Equity, "dates">) =>
    d3line<number>().x((_, i) => x(i)!).y((v) => y(v)).curve(curveMonotoneX)(data[k]) ?? "";
  const step = n > 1 ? (w - pad.l - pad.r) / (n - 1) : 1;
  const months = data.dates.map((d, i) => ({ d, i })).filter((t, k, arr) => k === 0 || t.d.slice(5, 7) !== arr[k - 1].d.slice(5, 7));
  const compactLegend = w < 560;

  return (
    <div>
      {compactLegend && (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px]">
          {SERIES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-ink-2">
              <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke={s.color} strokeWidth={s.width} strokeDasharray={s.dash} /></svg>
              {tx(s.label)}
            </span>
          ))}
        </div>
      )}
      <div ref={ref} className="relative w-full" style={{ height }}>
        {w > 0 && n > 1 && (
          <svg
            width={w}
            height={height}
            className="touch-none"
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const i = Math.round((e.clientX - r.left - pad.l) / step);
              setHover(i >= 0 && i < n ? i : null);
            }}
            onPointerLeave={() => setHover(null)}
          >
            {y.ticks(5).map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? C.axis : C.grid} strokeWidth={t === 0 ? 1.5 : 1} />
                <text x={pad.l + 2} y={y(t) - 4} fontSize={10.5} fill={C.muted} className="num">
                  {signed(t * 100, 0, "%")}
                </text>
              </g>
            ))}
            <text x={w - pad.r + 8} y={y(0)} dy="0.32em" fontSize={11} fill={C.muted}>
              IHSG
            </text>
            {months.map((t) => (
              <text key={t.d} x={x(t.i)} y={height - 6} fontSize={10.5} fill={C.muted}>
                {dateLabel(t.d, lang, { day: undefined, year: undefined, month: "short" })}
              </text>
            ))}
            {SERIES.map((s, k) => (
              <motion.path
                key={s.key}
                d={path(s.key)}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width}
                strokeDasharray={s.dash}
                strokeLinecap="round"
                initial={{ pathLength: reduce ? 1 : 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: reduce ? 0 : 1.2, delay: k * 0.12, ease: [0.23, 1, 0.32, 1] }}
              />
            ))}
            {!compactLegend &&
              SERIES.map((s) => {
                const v = data[s.key][n - 1];
                return (
                  <g key={s.key}>
                    <circle cx={x(n - 1)} cy={y(v)} r={3.5} fill={s.color} />
                    <text x={x(n - 1)! + 8} y={y(v)} dy="0.32em" fontSize={11.5} fill={s.color}>
                      <tspan className="num" fontWeight={600}>{signed(v * 100, 1, "%")}</tspan>
                      <tspan fill={C.muted}> {tx(s.label).replace("…", "")}</tspan>
                    </text>
                  </g>
                );
              })}
            {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} stroke={C.axis} strokeDasharray="3 3" />}
          </svg>
        )}
        {hover != null && (
          <Tooltip x={x(hover)!} y={pad.t + 30} show>
            <div className="mb-1 text-muted">{dateLabel(data.dates[hover], lang)}</div>
            {SERIES.map((s) => (
              <div key={s.key} className="flex justify-between gap-4">
                <span style={{ color: s.color }}>{tx(s.label)}</span>
                <span className="num text-ink">{signed(data[s.key][hover] * 100, 1, "%")}</span>
              </div>
            ))}
          </Tooltip>
        )}
      </div>
    </div>
  );
}

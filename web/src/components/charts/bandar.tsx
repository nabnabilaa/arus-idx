"use client";

import { scaleBand, scaleLinear } from "d3-scale";
import { motion } from "motion/react";
import { useState } from "react";
import { C, Tooltip, useWidth } from "./kit";
import { dateLabel, idr } from "@/lib/format";
import { useLang, type Bi } from "@/lib/i18n";

const SERIES: { key: "inst" | "retail" | "foreign"; label: Bi; color: string }[] = [
  { key: "inst", label: { id: "Broker institusi", en: "Institutional brokers" }, color: "#3987e5" },
  { key: "retail", label: { id: "Broker ritel", en: "Retail brokers" }, color: "#eb6834" },
  { key: "foreign", label: { id: "Investor asing", en: "Foreign investors" }, color: "#1baf7a" },
];

/** Grouped daily bars: who was net buying (above zero) or net selling (below) each day. */
export function BandarBars({ dates, inst, retail, foreign, height = 260 }: { dates: string[]; inst: number[]; retail: number[]; foreign: number[]; height?: number }) {
  const { tx, lang } = useLang();
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const data = { inst, retail, foreign };
  const pad = { l: 8, r: 62, t: 10, b: 24 };
  const x0 = scaleBand<number>().domain(dates.map((_, i) => i)).range([pad.l, w - pad.r]).paddingInner(0.28);
  const x1 = scaleBand<string>().domain(SERIES.map((s) => s.key)).range([0, x0.bandwidth()]).padding(0.08);
  const ext = Math.max(...SERIES.flatMap((s) => data[s.key].map(Math.abs)), 1);
  const y = scaleLinear().domain([-ext, ext]).range([height - pad.b, pad.t]).nice(4);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px]">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-ink-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {tx(s.label)}
          </span>
        ))}
        <span className="text-muted">· {tx({ id: "di atas garis = beli bersih, di bawah = jual bersih", en: "above the line = net buy, below = net sell" })}</span>
      </div>
      <div ref={ref} className="relative w-full" style={{ height }}>
        {w > 0 && (
          <svg width={w} height={height} onPointerLeave={() => setHover(null)}>
            {y.ticks(4).map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? C.axis : C.grid} />
                <text x={w - pad.r + 6} y={y(t)} dy="0.32em" fontSize={10.5} fill={C.muted} className="num">
                  {idr(t, lang)}
                </text>
              </g>
            ))}
            {dates.map((d, i) => (
              <g key={d} onPointerEnter={() => setHover(i)} opacity={hover == null || hover === i ? 1 : 0.45} style={{ transition: "opacity 150ms" }}>
                <rect x={x0(i)! - 2} y={pad.t} width={x0.bandwidth() + 4} height={height - pad.t - pad.b} fill="transparent" />
                {SERIES.map((s, k) => {
                  const v = data[s.key][i] ?? 0;
                  return (
                    <motion.rect
                      key={s.key}
                      x={x0(i)! + x1(s.key)!}
                      width={x1.bandwidth()}
                      rx={2}
                      fill={s.color}
                      initial={{ y: y(0), height: 0 }}
                      animate={{ y: Math.min(y(0), y(v)), height: Math.max(1, Math.abs(y(v) - y(0))) }}
                      transition={{ duration: 0.5, delay: i * 0.03 + k * 0.02, ease: [0.23, 1, 0.32, 1] }}
                    />
                  );
                })}
                <text x={x0(i)! + x0.bandwidth() / 2} y={height - 6} fontSize={10} fill={C.muted} textAnchor="middle">
                  {d.slice(8)}
                </text>
              </g>
            ))}
          </svg>
        )}
        {hover != null && (
          <Tooltip x={x0(hover)! + x0.bandwidth() / 2} y={pad.t + 20} show>
            <div className="mb-1 text-muted">{dateLabel(dates[hover], lang)}</div>
            {SERIES.map((s) => (
              <div key={s.key} className="flex justify-between gap-4">
                <span style={{ color: s.color }}>{tx(s.label)}</span>
                <span className={`num ${(data[s.key][hover] ?? 0) >= 0 ? "text-up" : "text-down"}`}>{idr(data[s.key][hover], lang)}</span>
              </div>
            ))}
          </Tooltip>
        )}
      </div>
    </div>
  );
}

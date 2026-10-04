"use client";

import { scaleBand, scaleLinear, scaleSqrt } from "d3-scale";
import { motion } from "motion/react";
import { useState } from "react";
import { C, Tooltip, useWidth } from "./kit";
import { useLang, type Bi } from "@/lib/i18n";
import { pct, signed } from "@/lib/format";

const EASE = [0.23, 1, 0.32, 1] as const;

/** Horizontal diverging bars around zero — used for signal contributions and AUC vs 0.5. */
export function DivergingBars({
  rows,
  height,
  center = 0,
  format = (v: number) => signed(v, 2),
  rowHeight = 30,
}: {
  rows: { key: string; label: string; sub?: string; value: number; note?: string }[];
  height?: number;
  center?: number;
  format?: (v: number) => string;
  rowHeight?: number;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const labelW = Math.min(230, Math.max(150, w * 0.36));
  const H = height ?? rows.length * rowHeight + 8;
  const ext = Math.max(...rows.map((r) => Math.abs(r.value - center)), 1e-6);
  const x = scaleLinear().domain([center - ext, center + ext]).range([labelW + 8, w - 56]);
  const y = scaleBand<string>().domain(rows.map((r) => r.key)).range([4, H - 4]).padding(0.3);
  return (
    <div ref={ref} className="relative w-full" style={{ height: H }}>
      {w > 0 && (
        <svg width={w} height={H}>
          <line x1={x(center)} x2={x(center)} y1={0} y2={H} stroke={C.axis} />
          {rows.map((r, i) => {
            const x0 = Math.min(x(center), x(r.value));
            const bw = Math.max(1.5, Math.abs(x(r.value) - x(center)));
            const pos = r.value >= center;
            const dim = hover != null && hover !== r.key;
            return (
              <g key={r.key} onPointerEnter={() => setHover(r.key)} onPointerLeave={() => setHover(null)} opacity={dim ? 0.45 : 1} style={{ transition: "opacity 150ms" }}>
                <rect x={0} y={y(r.key)! - 4} width={w} height={y.bandwidth() + 8} fill="transparent" />
                <text x={0} y={y(r.key)! + y.bandwidth() / 2} dy="0.32em" fontSize={12.5} fill={C.ink}>
                  {r.label}
                  {r.sub && (
                    <tspan fill={C.muted} fontSize={11}>{`  ${r.sub}`}</tspan>
                  )}
                </text>
                <motion.rect
                  y={y(r.key)}
                  height={y.bandwidth()}
                  rx={3}
                  fill={pos ? C.up : C.down}
                  initial={{ x: x(center), width: 0 }}
                  animate={{ x: x0, width: bw }}
                  transition={{ duration: 0.55, delay: i * 0.03, ease: EASE }}
                />
                <text
                  x={pos ? x0 + bw + 6 : x0 - 6}
                  y={y(r.key)! + y.bandwidth() / 2}
                  dy="0.32em"
                  textAnchor={pos ? "start" : "end"}
                  fontSize={11}
                  fill={C.ink2}
                  className="num"
                >
                  {format(r.value)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/** Reliability diagram: predicted vs observed with Wilson bands and a perfect-calibration diagonal. */
export function Reliability({ rows, height = 320 }: { rows: { pred: number; obs: number; n: number; lo: number | null; hi: number | null }[]; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const { tx } = useLang();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 44, r: 14, t: 10, b: 36 };
  const pts = rows.filter((r) => r.n > 0);
  const lo = Math.max(0, Math.min(...pts.map((r) => Math.min(r.pred, r.lo ?? r.obs))) - 0.05);
  const hi = Math.min(1, Math.max(...pts.map((r) => Math.max(r.pred, r.hi ?? r.obs))) + 0.05);
  const x = scaleLinear().domain([lo, hi]).range([pad.l, w - pad.r]);
  const y = scaleLinear().domain([lo, hi]).range([height - pad.b, pad.t]);
  const r = scaleSqrt().domain([0, Math.max(...pts.map((p) => p.n))]).range([3, 13]);
  const ticks = x.ticks(5);
  const h = hover != null ? pts[hover] : null;
  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={pad.t} y2={height - pad.b} stroke={C.grid} />
              <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={C.grid} />
              <text x={x(t)} y={height - pad.b + 16} fontSize={11} fill={C.muted} textAnchor="middle" className="num">{pct(t)}</text>
              <text x={pad.l - 8} y={y(t)} dy="0.32em" fontSize={11} fill={C.muted} textAnchor="end" className="num">{pct(t)}</text>
            </g>
          ))}
          <line x1={x(lo)} y1={y(lo)} x2={x(hi)} y2={y(hi)} stroke={C.axis} strokeDasharray="4 4" />
          <text x={x(hi) - 4} y={y(hi) + 14} fontSize={11} fill={C.muted} textAnchor="end">{tx({ id: "kalibrasi sempurna", en: "perfect calibration" })}</text>
          <text x={(pad.l + w - pad.r) / 2} y={height - 4} fontSize={11} fill={C.muted} textAnchor="middle">{tx({ id: "Probabilitas yang diprediksi", en: "Predicted probability" })}</text>
          {pts.map((p, i) => (
            <g key={i} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              {p.lo != null && p.hi != null && (
                <line x1={x(p.pred)} x2={x(p.pred)} y1={y(p.lo)} y2={y(p.hi)} stroke={C.up} strokeOpacity={0.55} strokeWidth={2} strokeLinecap="round" />
              )}
              <motion.circle
                cx={x(p.pred)}
                cy={y(p.obs)}
                fill={C.up}
                stroke="#070b14"
                strokeWidth={2}
                initial={{ r: 0 }}
                animate={{ r: r(p.n) }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: EASE }}
              />
              <circle cx={x(p.pred)} cy={y(p.obs)} r={16} fill="transparent" />
            </g>
          ))}
        </svg>
      )}
      {h && (
        <Tooltip x={x(h.pred)} y={y(h.obs)} show>
          <div>{tx({ id: "Prediksi", en: "Predicted" })} <span className="num text-ink">{pct(h.pred, 1)}</span></div>
          <div>{tx({ id: "Terjadi", en: "Observed" })} <span className="num text-ink">{pct(h.obs, 1)}</span></div>
          <div className="text-muted">n = {h.n.toLocaleString()}</div>
        </Tooltip>
      )}
    </div>
  );
}

/** Vertical bars with error whiskers and a reference line (deciles). */
export function DecileBars({ rows, base, height = 300 }: { rows: { decile: number; hit: number; excess: number; n: number; lo: number; hi: number }[]; base: number; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const { tx } = useLang();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 44, r: 10, t: 14, b: 34 };
  const x = scaleBand<number>().domain(rows.map((r) => r.decile)).range([pad.l, w - pad.r]).padding(0.28);
  const top = Math.max(...rows.map((r) => r.hi), base) + 0.04;
  const bot = Math.max(0, Math.min(...rows.map((r) => r.lo), base) - 0.06);
  const y = scaleLinear().domain([bot, top]).range([height - pad.b, pad.t]).nice(5);
  const h = hover != null ? rows.find((r) => r.decile === hover) : null;
  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height}>
          {y.ticks(5).map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={C.grid} />
              <text x={pad.l - 8} y={y(t)} dy="0.32em" fontSize={11} fill={C.muted} textAnchor="end" className="num">{pct(t)}</text>
            </g>
          ))}
          {rows.map((r, i) => (
            <g key={r.decile} onPointerEnter={() => setHover(r.decile)} onPointerLeave={() => setHover(null)} opacity={hover != null && hover !== r.decile ? 0.5 : 1} style={{ transition: "opacity 150ms" }}>
              <motion.rect
                x={x(r.decile)}
                width={x.bandwidth()}
                rx={4}
                fill={r.hit >= base ? C.up : C.down}
                initial={{ y: y(bot), height: 0 }}
                animate={{ y: y(r.hit), height: y(bot) - y(r.hit) }}
                transition={{ duration: 0.55, delay: i * 0.04, ease: EASE }}
              />
              <line x1={x(r.decile)! + x.bandwidth() / 2} x2={x(r.decile)! + x.bandwidth() / 2} y1={y(r.lo)} y2={y(r.hi)} stroke={C.ink2} strokeWidth={1.2} />
              <text x={x(r.decile)! + x.bandwidth() / 2} y={height - pad.b + 16} fontSize={11} fill={C.muted} textAnchor="middle" className="num">{r.decile + 1}</text>
            </g>
          ))}
          <line x1={pad.l} x2={w - pad.r} y1={y(base)} y2={y(base)} stroke={C.warn} strokeDasharray="4 4" />
          <text x={w - pad.r} y={y(base) - 6} fontSize={11} fill={C.warn} textAnchor="end">{tx({ id: "acak", en: "random" })} {pct(base)}</text>
          <text x={(pad.l + w - pad.r) / 2} y={height - 3} fontSize={11} fill={C.muted} textAnchor="middle">{tx({ id: "Desil skor (10 = tertinggi)", en: "Score decile (10 = highest)" })}</text>
        </svg>
      )}
      {h && (
        <Tooltip x={x(h.decile)! + x.bandwidth() / 2} y={y(h.hit)} show>
          <div>{tx({ id: "Desil", en: "Decile" })} {h.decile + 1}</div>
          <div>{tx({ id: "Mengalahkan IHSG", en: "Beat IHSG" })} <span className="num text-ink">{pct(h.hit, 1)}</span></div>
          <div>{tx({ id: "Rata2 selisih", en: "Avg excess" })} <span className="num text-ink">{signed(h.excess * 100, 2, "%")}</span></div>
          <div className="text-muted">n = {h.n.toLocaleString()}</div>
        </Tooltip>
      )}
    </div>
  );
}

/** Sector rotation map: relative strength (x) vs foreign intensity (y), bubble = count. */
export function SectorMap({
  rows,
  height = 480,
  label,
}: {
  rows: { key: string; x: number; y: number; n: number; note: string }[];
  height?: number;
  label: (k: string) => string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const { tx } = useLang();
  const [hover, setHover] = useState<string | null>(null);
  const pad = { l: 52, r: 20, t: 20, b: 40 };
  const ex = Math.max(...rows.map((r) => Math.abs(r.x)), 0.01) * 1.15;
  const ey = Math.max(...rows.map((r) => Math.abs(r.y)), 0.001) * 1.2;
  const x = scaleLinear().domain([-ex, ex]).range([pad.l, w - pad.r]);
  const y = scaleLinear().domain([-ey, ey]).range([height - pad.b, pad.t]);
  const rad = scaleSqrt().domain([0, Math.max(...rows.map((r) => r.n))]).range([4, 22]);
  const quad: { qx: number; qy: number; t: Bi }[] = [
    { qx: 1, qy: 1, t: { id: "Memimpin & dibeli asing", en: "Leading & foreign-bought" } },
    { qx: -1, qy: 1, t: { id: "Tertinggal tapi dikumpulkan asing", en: "Lagging but foreign-accumulated" } },
    { qx: 1, qy: -1, t: { id: "Memimpin tanpa asing", en: "Leading without foreigners" } },
    { qx: -1, qy: -1, t: { id: "Tertinggal & dijual asing", en: "Lagging & foreign-sold" } },
  ];
  const h = rows.find((r) => r.key === hover);
  const sorted = [...rows].sort((a, b) => b.n - a.n);
  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height}>
          <line x1={x(0)} x2={x(0)} y1={pad.t} y2={height - pad.b} stroke={C.axis} />
          <line x1={pad.l} x2={w - pad.r} y1={y(0)} y2={y(0)} stroke={C.axis} />
          {quad.map((q) => (
            <text
              key={q.t.en}
              x={q.qx > 0 ? w - pad.r - 6 : pad.l + 6}
              y={q.qy > 0 ? pad.t + 12 : height - pad.b - 8}
              textAnchor={q.qx > 0 ? "end" : "start"}
              fontSize={11.5}
              fill={C.muted}
            >
              {tx(q.t)}
            </text>
          ))}
          <text x={(pad.l + w - pad.r) / 2} y={height - 6} fontSize={11} fill={C.muted} textAnchor="middle">
            {tx({ id: "Kekuatan relatif vs IHSG, 20 hari →", en: "Relative strength vs IHSG, 20 days →" })}
          </text>
          <text transform={`translate(14 ${(pad.t + height - pad.b) / 2}) rotate(-90)`} fontSize={11} fill={C.muted} textAnchor="middle">
            {tx({ id: "Net asing ÷ transaksi →", en: "Foreign net ÷ turnover →" })}
          </text>
          {sorted.map((r, i) => {
            const good = r.x > 0 && r.y > 0;
            return (
              <g key={r.key} onPointerEnter={() => setHover(r.key)} onPointerLeave={() => setHover(null)} style={{ cursor: "default" }}>
                <motion.circle
                  cx={x(r.x)}
                  cy={y(r.y)}
                  fill={good ? C.current : C.up}
                  fillOpacity={hover == null || hover === r.key ? 0.55 : 0.18}
                  stroke={good ? C.current : C.up}
                  strokeWidth={1.5}
                  initial={{ r: 0 }}
                  animate={{ r: rad(r.n) }}
                  transition={{ duration: 0.6, delay: i * 0.03, ease: EASE }}
                />
                {(good || r.n >= 5 || hover === r.key) && (
                  <text x={x(r.x)} y={y(r.y) - rad(r.n) - 6} fontSize={11} fill={C.ink2} textAnchor="middle">
                    {label(r.key)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {h && (
        <Tooltip x={x(h.x)} y={y(h.y) - rad(h.n)} show>
          <div className="font-medium text-ink">{label(h.key)}</div>
          <div>RS 20h <span className="num text-ink">{signed(h.x * 100, 1, "%")}</span></div>
          <div>{tx({ id: "Asing", en: "Foreign" })} <span className="num text-ink">{signed(h.y * 100, 2, "%")}</span></div>
          <div className="text-muted">{h.note}</div>
        </Tooltip>
      )}
    </div>
  );
}

/** Diverging heatmap (rows = sub-sectors, cols = weeks). */
export function Heatmap({ rows, cols, values, label }: { rows: string[]; cols: string[]; values: (number | null)[][]; label: (k: string) => string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const labelW = Math.min(200, Math.max(120, w * 0.24));
  const cell = 20;
  const H = rows.length * cell + 26;
  const flat = values.flat().filter((v): v is number => v != null);
  const lim = flat.length ? [...flat].map(Math.abs).sort((a, b) => a - b)[Math.floor(flat.length * 0.95)] || 0.05 : 0.05;
  const x = scaleBand<number>().domain(cols.map((_, i) => i)).range([labelW, w]).padding(0.08);
  const color = (v: number | null) => {
    if (v == null) return "transparent";
    const t = Math.max(-1, Math.min(1, v / lim));
    const a = Math.abs(t);
    return t >= 0 ? `rgb(57 135 229 / ${0.12 + a * 0.78})` : `rgb(230 103 103 / ${0.12 + a * 0.78})`;
  };
  const hv = hover ? values[hover.r][hover.c] : null;
  return (
    <div ref={ref} className="relative w-full" style={{ height: H }}>
      {w > 0 && (
        <svg width={w} height={H} onPointerLeave={() => setHover(null)}>
          {rows.map((r, ri) => (
            <g key={r}>
              <text x={0} y={ri * cell + cell / 2} dy="0.32em" fontSize={11.5} fill={hover?.r === ri ? C.ink : C.ink2}>{label(r)}</text>
              {cols.map((c, ci) => (
                <rect
                  key={c}
                  x={x(ci)}
                  y={ri * cell + 2}
                  width={x.bandwidth()}
                  height={cell - 4}
                  rx={3}
                  fill={color(values[ri][ci])}
                  stroke={hover?.r === ri && hover?.c === ci ? C.ink : "none"}
                  onPointerEnter={() => setHover({ r: ri, c: ci })}
                />
              ))}
            </g>
          ))}
          {cols.map((c, ci) =>
            ci % 4 === 0 ? (
              <text key={c} x={x(ci)} y={H - 6} fontSize={10.5} fill={C.muted}>{c.slice(5)}</text>
            ) : null,
          )}
        </svg>
      )}
      {hover && hv != null && (
        <Tooltip x={x(hover.c)! + x.bandwidth() / 2} y={hover.r * cell} show>
          <div className="font-medium text-ink">{label(rows[hover.r])}</div>
          <div className="text-muted">{cols[hover.c]}</div>
          <div className={`num ${hv >= 0 ? "text-up" : "text-down"}`}>{signed(hv * 100, 1, "%")}</div>
        </Tooltip>
      )}
    </div>
  );
}

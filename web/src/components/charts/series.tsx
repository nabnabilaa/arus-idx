"use client";

import { scaleBand, scaleLinear, scalePoint } from "d3-scale";
import { line as d3line, area as d3area, curveMonotoneX } from "d3-shape";
import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { C, Tooltip, useWidth } from "./kit";
import { dateLabel, idr, price } from "@/lib/format";
import { useLang } from "@/lib/i18n";

type Pt = { date: string; v: number | null };

/** Price line with an area wash, crosshair and tooltip. */
export function LineArea({ data, height = 220, format = "price" }: { data: Pt[]; height?: number; format?: "price" | "index" }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const { lang } = useLang();
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 8, r: 52, t: 10, b: 22 };
  const pts = data.filter((d) => d.v != null) as { date: string; v: number }[];

  const { x, y, path, areaPath, ticks } = useMemo(() => {
    const x = scalePoint<string>().domain(pts.map((d) => d.date)).range([pad.l, Math.max(pad.l + 1, w - pad.r)]);
    const vals = pts.map((d) => d.v);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const m = (hi - lo) * 0.08 || hi * 0.02;
    const y = scaleLinear().domain([lo - m, hi + m]).range([height - pad.b, pad.t]).nice(4);
    const path = d3line<{ date: string; v: number }>().x((d) => x(d.date)!).y((d) => y(d.v)).curve(curveMonotoneX)(pts) ?? "";
    const areaPath =
      d3area<{ date: string; v: number }>().x((d) => x(d.date)!).y0(height - pad.b).y1((d) => y(d.v)).curve(curveMonotoneX)(pts) ?? "";
    return { x, y, path, areaPath, ticks: y.ticks(4) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts.length, w, height, data]);

  const step = pts.length > 1 ? (w - pad.l - pad.r) / (pts.length - 1) : 1;
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round((e.clientX - r.left - pad.l) / step);
    setHover(Math.max(0, Math.min(pts.length - 1, i)));
  };
  const h = hover != null ? pts[hover] : null;
  const first = pts[0]?.v;
  const last = pts[pts.length - 1]?.v;
  const color = last != null && first != null && last >= first ? C.up : C.down;
  const months = pts.filter((d, i) => i === 0 || d.date.slice(5, 7) !== pts[i - 1].date.slice(5, 7));

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {w > 0 && pts.length > 1 && (
        <svg width={w} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="touch-none">
          <defs>
            <linearGradient id="la-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.22" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={C.grid} />
              <text x={w - pad.r + 8} y={y(t)} dy="0.32em" fontSize={11} fill={C.muted} className="num">
                {format === "price" ? price(t, lang) : t.toLocaleString(lang === "id" ? "id-ID" : "en-US")}
              </text>
            </g>
          ))}
          {months.map((d) => (
            <text key={d.date} x={x(d.date)} y={height - 6} fontSize={11} fill={C.muted}>
              {dateLabel(d.date, lang, { day: undefined, year: undefined, month: "short" })}
            </text>
          ))}
          <motion.path d={areaPath} fill="url(#la-fill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} />
          <motion.path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={2}
            initial={{ pathLength: reduce ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: reduce ? 0 : 1.1, ease: [0.23, 1, 0.32, 1] }}
          />
          {h && (
            <g>
              <line x1={x(h.date)} x2={x(h.date)} y1={pad.t} y2={height - pad.b} stroke={C.axis} strokeDasharray="3 3" />
              <circle cx={x(h.date)} cy={y(h.v)} r={4.5} fill={color} stroke="#070b14" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}
      {h && (
        <Tooltip x={x(h.date)!} y={y(h.v)} show>
          <div className="text-muted">{dateLabel(h.date, lang)}</div>
          <div className="num text-sm font-medium text-ink">
            {format === "price" ? `Rp${price(h.v, lang)}` : h.v.toLocaleString(lang === "id" ? "id-ID" : "en-US", { maximumFractionDigits: 0 })}
          </div>
        </Tooltip>
      )}
    </div>
  );
}

/** Signed daily bars (blue = net buy, red = net sell) with an optional running total. */
export function SignedBars({ data, height = 160 }: { data: Pt[]; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const { lang } = useLang();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 8, r: 52, t: 8, b: 8 };
  const pts = data.map((d) => ({ date: d.date, v: d.v ?? 0 }));
  const x = scaleBand<string>().domain(pts.map((d) => d.date)).range([pad.l, Math.max(pad.l + 1, w - pad.r)]).padding(0.22);
  const ext = Math.max(...pts.map((d) => Math.abs(d.v)), 1);
  const y = scaleLinear().domain([-ext, ext]).range([height - pad.b, pad.t]);
  const h = hover != null ? pts[hover] : null;
  const total = pts.reduce((a, b) => a + b.v, 0);

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} onPointerLeave={() => setHover(null)}>
          <line x1={pad.l} x2={w - pad.r} y1={y(0)} y2={y(0)} stroke={C.axis} />
          <text x={w - pad.r + 8} y={pad.t + 4} fontSize={11} fill={C.muted} className="num">{idr(ext, lang)}</text>
          <text x={w - pad.r + 8} y={height - pad.b} fontSize={11} fill={C.muted} className="num">{idr(-ext, lang)}</text>
          {pts.map((d, i) => {
            const top = Math.min(y(0), y(d.v));
            const hh = Math.max(1, Math.abs(y(d.v) - y(0)));
            return (
              <g key={d.date} onPointerEnter={() => setHover(i)}>
                <rect x={x(d.date)! - 1} y={pad.t} width={x.bandwidth() + 2} height={height - pad.t - pad.b} fill="transparent" />
                <motion.rect
                  x={x(d.date)}
                  width={Math.max(1, x.bandwidth())}
                  rx={Math.min(2, x.bandwidth() / 2)}
                  fill={d.v >= 0 ? C.up : C.down}
                  opacity={hover == null || hover === i ? 1 : 0.45}
                  initial={{ y: y(0), height: 0 }}
                  animate={{ y: top, height: hh }}
                  transition={{ duration: 0.5, delay: Math.min(0.4, i * 0.004), ease: [0.23, 1, 0.32, 1] }}
                />
              </g>
            );
          })}
        </svg>
      )}
      {h && (
        <Tooltip x={x(h.date)! + x.bandwidth() / 2} y={y(Math.max(0, h.v))} show>
          <div className="text-muted">{dateLabel(h.date, lang)}</div>
          <div className={`num text-sm font-medium ${h.v >= 0 ? "text-up" : "text-down"}`}>{idr(h.v, lang)}</div>
        </Tooltip>
      )}
      <div className="sr-only">{idr(total, lang)}</div>
    </div>
  );
}

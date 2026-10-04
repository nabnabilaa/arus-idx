"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { VERDICT, VERDICT_ORDER, verdictOf, type VerdictKey } from "@/lib/verdict";

const LO = 0.4;
const HI = 0.6;

/** Probability at which each verdict starts, from the calibration curve p = σ(a + b(q − .5)). */
export function verdictCuts(cal: { a: number; b: number }) {
  const p = (q: number) => 1 / (1 + Math.exp(-(cal.a + cal.b * (q - 0.5))));
  return { caution: p(0.1), weak: p(0.3), edge: p(0.7), strong: p(0.9) };
}

const angle = (p: number) => Math.PI * (1 - (Math.min(HI, Math.max(LO, p)) - LO) / (HI - LO));
// Server and browser disagree in the 13th decimal of trig results; round so hydration matches.
const r2 = (v: number) => Math.round(v * 100) / 100;

function arc(cx: number, cy: number, r: number, p0: number, p1: number) {
  const a0 = angle(p0);
  const a1 = angle(p1);
  const x0 = r2(cx + r * Math.cos(a0));
  const y0 = r2(cy - r * Math.sin(a0));
  const x1 = r2(cx + r * Math.cos(a1));
  const y1 = r2(cy - r * Math.sin(a1));
  return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
}

/**
 * The Arus Meter: a needle on a 40–60 scale whose coloured zones come from the tested
 * calibration curve. The needle starts at 50 (a coin flip) and settles on the score.
 */
export function ArusMeter({
  value,
  q,
  cal,
  size = 300,
}: {
  value: number;
  q: number;
  cal: { a: number; b: number };
  size?: number;
}) {
  const { tx } = useLang();
  const reduce = useReducedMotion();
  const cuts = verdictCuts(cal);
  const v = verdictOf(q);
  const mv = useMotionValue(0.5);
  const [shown, setShown] = useState(0.5);

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      setShown(value);
      return;
    }
    mv.set(0.5);
    const c = animate(mv, value, { duration: 1.2, delay: 0.15, ease: [0.23, 1, 0.32, 1], onUpdate: setShown });
    return () => c.stop();
  }, [value, reduce, mv]);

  const w = size;
  const h = Math.round(size * 0.62);
  const cx = w / 2;
  const cy = h - 14;
  const r = w / 2 - 22;
  const tipX = useTransform(mv, (p) => r2(cx + (r - 20) * Math.cos(angle(p))));
  const tipY = useTransform(mv, (p) => r2(cy - (r - 20) * Math.sin(angle(p))));

  const zones: { key: VerdictKey; from: number; to: number }[] = [
    { key: "caution", from: LO, to: cuts.caution },
    { key: "weak", from: cuts.caution, to: cuts.weak },
    { key: "neutral", from: cuts.weak, to: cuts.edge },
    { key: "edge", from: cuts.edge, to: cuts.strong },
    { key: "strong", from: cuts.strong, to: HI },
  ];

  return (
    <div className="flex flex-col items-center">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="max-w-full overflow-visible" role="img" aria-label={`${Math.round(value * 100)} / 100 · ${tx(VERDICT[v].label)}`}>
        {zones.map((z) => (
          <path
            key={z.key}
            d={arc(cx, cy, r, z.from + 0.0015, z.to - 0.0015)}
            stroke={VERDICT[z.key].color}
            strokeOpacity={z.key === v ? 0.95 : 0.28}
            strokeWidth={z.key === v ? 16 : 12}
            strokeLinecap="round"
            fill="none"
            style={{ transition: "stroke-opacity 300ms, stroke-width 300ms" }}
          />
        ))}
        {[0.4, 0.45, 0.5, 0.55, 0.6].map((t) => {
          const a = angle(t);
          return (
            <text key={t} x={r2(cx + (r + 18) * Math.cos(a))} y={r2(cy - (r + 18) * Math.sin(a))} textAnchor="middle" dominantBaseline="middle" fontSize={10.5} fill="#75839a" className="num">
              {Math.round(t * 100)}
            </text>
          );
        })}
        <motion.line x1={cx} y1={cy} x2={tipX} y2={tipY} stroke="#e9eef6" strokeWidth={3} strokeLinecap="round" suppressHydrationWarning />
        <circle cx={cx} cy={cy} r={7} fill="#e9eef6" stroke="#070b14" strokeWidth={3} />
      </svg>
      <div className="-mt-2 text-center">
        <div className="num text-5xl font-semibold tracking-[-0.04em] text-ink">
          {Math.round(shown * 100)}
          <span className="ml-1 text-lg font-normal text-muted">/100</span>
        </div>
        <div className={`mt-1 text-[15px] font-semibold ${VERDICT[v].text}`}>{tx(VERDICT[v].label)}</div>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-muted">
        {VERDICT_ORDER.slice().reverse().map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: VERDICT[k].color }} />
            {tx(VERDICT[k].short)}
          </span>
        ))}
      </div>
    </div>
  );
}

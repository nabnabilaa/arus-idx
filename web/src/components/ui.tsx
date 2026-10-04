"use client";

import { motion } from "motion/react";
import { Star } from "lucide-react";
import { useId } from "react";
import { PUBLISHED } from "@/lib/data";
import { describe } from "@/lib/features";
import { useLang } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import type { FeatureKey, Horizon } from "@/lib/types";
import { HORIZON_LABEL, VERDICT, type VerdictKey } from "@/lib/verdict";

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  label: string;
  size?: "md" | "lg";
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-lg bg-surface p-0.5 ring-1 ring-line">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`relative cursor-pointer whitespace-nowrap rounded-md transition-colors duration-150 ${size === "lg" ? "px-4 py-2 text-[14px]" : "px-2.5 py-1.5 text-[12.5px]"} ${
            value === o.value ? "text-ink" : "text-muted hover:text-ink-2"
          }`}
        >
          {value === o.value && (
            <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-md bg-raised ring-1 ring-line-strong" transition={{ type: "spring", stiffness: 600, damping: 42 }} />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function HorizonToggle({ size = "md" }: { size?: "md" | "lg" }) {
  const { tx } = useLang();
  const { horizon, setHorizon } = usePrefs();
  if (PUBLISHED.length < 2) return null;
  return (
    <Segmented<Horizon>
      size={size}
      label={tx({ id: "Jangka waktu", en: "Time horizon" })}
      value={horizon}
      onChange={setHorizon}
      options={PUBLISHED.map((h) => ({
        value: h,
        label: (
          <span className="flex items-baseline gap-1.5">
            {tx(HORIZON_LABEL[h].name)}
            {size === "lg" && <span className="hidden text-[11px] text-muted sm:inline">{tx(HORIZON_LABEL[h].who)}</span>}
          </span>
        ),
      }))}
    />
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="group flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-ink-2 hover:text-ink">
      <span className={`relative h-[18px] w-8 shrink-0 rounded-full transition-colors duration-200 ${checked ? "bg-arus" : "bg-raised ring-1 ring-line-strong"}`}>
        <motion.span
          className="absolute top-[3px] h-3 w-3 rounded-full shadow"
          animate={{ left: checked ? 17 : 3, backgroundColor: checked ? "#070b14" : "#aab5c7" }}
          transition={{ type: "spring", stiffness: 700, damping: 40 }}
        />
      </span>
      {label}
    </button>
  );
}

export function VerdictBadge({ v, size = "sm" }: { v: VerdictKey; size?: "sm" | "md" }) {
  const { tx } = useLang();
  const d = VERDICT[v];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full ring-1 ${d.ring} ${d.bg} ${d.text} ${size === "md" ? "px-2.5 py-1 text-[12.5px]" : "px-2 py-0.5 text-[11.5px]"} font-medium`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: d.color }} />
      {tx(d.label)}
    </span>
  );
}

/** A reason chip: describes the stock's actual state ("Calm price action"), coloured by whether it helps. */
export function Reason({ k, pctl, helps }: { k: FeatureKey; pctl: number | null | undefined; helps: boolean }) {
  const { tx } = useLang();
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] ring-1 ${
        helps ? "bg-up/10 text-[#9cc5f5] ring-up/25" : "bg-down/10 text-[#f0a3a3] ring-down/25"
      }`}
    >
      <span aria-hidden>{helps ? "+" : "−"}</span>
      {tx(describe(k, pctl))}
    </span>
  );
}

export function Badge({ children, tone = "neutral", title }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "current"; title?: string }) {
  const cls = {
    neutral: "text-ink-2 ring-line-strong",
    good: "text-[#7fd4a8] ring-aqua/40 bg-aqua/10",
    warn: "text-warn ring-warn/40 bg-warn/10",
    current: "text-arus ring-arus/40 bg-arus/10",
  }[tone];
  return (
    <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10.5px] font-medium tracking-wide ring-1 ${cls}`}>
      {children}
    </span>
  );
}

export function StarButton({ symbol, size = 16 }: { symbol: string; size?: number }) {
  const { tx } = useLang();
  const { isWatched, toggleWatch } = usePrefs();
  const on = isWatched(symbol);
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWatch(symbol);
      }}
      aria-pressed={on}
      aria-label={on ? tx({ id: `Hapus ${symbol} dari pantauan`, en: `Remove ${symbol} from watchlist` }) : tx({ id: `Pantau ${symbol}`, en: `Watch ${symbol}` })}
      className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-raised hover:text-warn"
    >
      <motion.span animate={{ scale: on ? [1, 1.25, 1] : 1 }} transition={{ duration: 0.25 }}>
        <Star size={size} className={on ? "fill-warn text-warn" : ""} />
      </motion.span>
    </button>
  );
}

/** Score bar on a 40–60 scale with a coin-flip tick at 50. */
export function ScoreBar({ value, lo, hi, color }: { value: number; lo?: number | null; hi?: number | null; color: string }) {
  const pos = (p: number) => `${Math.min(100, Math.max(0, ((p - 0.4) / 0.2) * 100))}%`;
  return (
    <div className="relative h-4 w-full min-w-24">
      <div className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
      {lo != null && hi != null && (
        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full opacity-25" style={{ left: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})`, background: color }} />
      )}
      <div className="absolute left-1/2 top-1/2 h-3 w-px -translate-y-1/2 bg-muted" />
      <div className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-ground" style={{ left: pos(value), background: color }} />
    </div>
  );
}

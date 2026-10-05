"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, Clock, Coins, Landmark, Scissors, Split, Ticket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { amount, useAgendaDetail } from "@/components/agenda";
import { C } from "@/components/charts/kit";
import { AGENDA_LABEL } from "@/lib/agenda";
import { dateLabel, pct, price, signed } from "@/lib/format";
import { T, useLang, type Bi } from "@/lib/i18n";
import type { AgendaBook, AgendaItem, AgendaType, DividendStudy } from "@/lib/types";

const EASE = [0.23, 1, 0.32, 1] as const;

const TYPE_STYLE: Record<AgendaType, { color: string; bg: string; icon: React.ReactNode }> = {
  dividend: { color: "#7fd4a8", bg: "bg-aqua/10 ring-aqua/30", icon: <Coins size={15} /> },
  agm: { color: "#5cc8ff", bg: "bg-arus/10 ring-arus/30", icon: <Landmark size={15} /> },
  right_issue: { color: "#fab219", bg: "bg-warn/10 ring-warn/30", icon: <Ticket size={15} /> },
  stock_split: { color: "#c9a7ff", bg: "bg-[#c9a7ff]/10 ring-[#c9a7ff]/30", icon: <Split size={15} /> },
  warrant: { color: "#aab5c7", bg: "bg-raised ring-line-strong", icon: <Scissors size={15} /> },
  bonus: { color: "#aab5c7", bg: "bg-raised ring-line-strong", icon: <Coins size={15} /> },
};

const DAY = 864e5;
const toDay = (d: string) => new Date(d + "T00:00:00").getTime();

/** "today", "tomorrow", "in 3 days" against the visitor's own date, computed after mount (the page is static). */
function useToday() {
  const [today, setToday] = useState<number | null>(null);
  useEffect(() => {
    const n = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime());
  }, []);
  return today;
}

function countdown(date: string, today: number | null): Bi | null {
  if (today == null) return null;
  const n = Math.round((toDay(date) - today) / DAY);
  if (n < 0) return { id: "sudah lewat", en: "passed" };
  if (n === 0) return { id: "hari ini", en: "today" };
  if (n === 1) return { id: "besok", en: "tomorrow" };
  return { id: `${n} hari lagi`, en: `in ${n} days` };
}

function Sym({ s, ranked, className = "" }: { s: string; ranked: boolean; className?: string }) {
  return ranked ? (
    <Link href={`/saham/${s}/`} className={`hover:text-arus ${className}`}>{s}</Link>
  ) : (
    <span className={className}>{s}</span>
  );
}

const shortName = (n: string | null) => (n ?? "").replace(/^PT\.? /, "").replace(/ Tbk\.?$/, "");

/* ------------------------------------------------------------- countdown cards */
function Soon({ items, ranked, today }: { items: AgendaItem[]; ranked: Set<string>; today: number | null }) {
  const { tx, lang } = useLang();
  const detail = useAgendaDetail();
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
      {items.map((it, i) => {
        const st = TYPE_STYLE[it.type];
        const cd = countdown(it.type === "dividend" && it.cum ? it.cum : it.date, today);
        const d = new Date(it.date + "T00:00:00");
        return (
          <motion.article
            key={`${it.type}-${it.s}-${it.date}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05, ease: EASE }}
            className="relative w-64 shrink-0 snap-start overflow-hidden rounded-2xl bg-surface p-4 ring-1 ring-line sm:w-auto"
          >
            <div className="absolute inset-x-0 top-0 h-1" style={{ background: st.color }} />
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <span className="num text-[2.6rem] font-semibold leading-none tracking-tight text-ink">{d.getDate()}</span>
                <span className="text-[13px] uppercase text-ink-2">{d.toLocaleDateString(lang === "id" ? "id-ID" : "en-GB", { month: "short", weekday: "short" })}</span>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${st.bg}`} style={{ color: st.color }}>
                {st.icon}
                {tx(AGENDA_LABEL[it.type].label)}
              </span>
            </div>
            <div className="mt-4">
              <Sym s={it.s} ranked={ranked.has(it.s)} className="text-2xl font-semibold tracking-tight text-ink" />
              <div className="truncate text-[12.5px] text-muted">{shortName(it.name)}</div>
            </div>
            {it.type === "dividend" && it.yield != null ? (
              <div className="mt-3 flex items-baseline gap-2">
                <span className="num text-xl font-semibold" style={{ color: st.color }}>{pct(it.yield, 1)}</span>
                <span className="num text-[12px] text-muted">Rp{amount(it.amt, lang)}/{tx({ id: "saham", en: "sh" })}</span>
              </div>
            ) : (
              <div className="num mt-3 text-[13px] text-ink-2">{detail(it)}</div>
            )}
            {cd && (
              <div className="mt-3 flex items-center gap-1.5 border-t border-line pt-2.5 text-[12px] text-ink-2">
                <Clock size={13} className="text-muted" />
                {it.type === "dividend" && it.cum
                  ? tx({ id: `Terakhir beli ${dateLabel(it.cum, "id", { year: undefined })} · ${cd.id}`, en: `Buy by ${dateLabel(it.cum, "en", { year: undefined })} · ${cd.en}` })
                  : tx(cd)}
              </div>
            )}
          </motion.article>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- dividend leaderboard */
function DividendBoard({ items, ranked, today }: { items: AgendaItem[]; ranked: Set<string>; today: number | null }) {
  const { tx, lang } = useLang();
  const rows = [...items].sort((a, b) => (b.yield ?? 0) - (a.yield ?? 0));
  const max = Math.max(...rows.map((r) => r.yield ?? 0), 0.01);
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
      {rows.map((it, i) => {
        const cd = it.cum ? countdown(it.cum, today) : null;
        return (
          <li key={`${it.s}-${it.date}`} className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-3.5 sm:grid-cols-[2rem_minmax(0,11rem)_minmax(0,1fr)_minmax(0,13rem)]">
            <span className="num text-[13px] text-muted">{i + 1}</span>
            <div className="min-w-0">
              <Sym s={it.s} ranked={ranked.has(it.s)} className="text-[15px] font-semibold text-ink" />
              <div className="truncate text-[12px] text-muted">{shortName(it.name)}</div>
            </div>
            <div className="col-start-2 flex items-center gap-3 sm:col-start-auto">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-raised">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, #199e70, #7fd4a8)" }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${Math.max(3, ((it.yield ?? 0) / max) * 100)}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: i * 0.05, ease: EASE }}
                />
              </div>
              <span className="num w-14 text-right text-[15px] font-semibold text-[#7fd4a8]">{pct(it.yield, 1)}</span>
            </div>
            <div className="col-start-2 text-[12px] leading-snug text-ink-2 sm:col-start-auto sm:text-right">
              <span className="num">Rp{amount(it.amt, lang)}</span>
              {tx({ id: " per saham", en: " per share" })}
              <span className="block text-muted">
                {it.cum ? tx({ id: `beli s.d. ${dateLabel(it.cum, "id", { year: undefined })}`, en: `buy by ${dateLabel(it.cum, "en", { year: undefined })}` }) : ""}
                {cd ? ` · ${tx(cd)}` : ""}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------- event study */
function ExDividendChart({ st }: { st: DividendStudy }) {
  const { tx, lang } = useLang();
  const p = st.path;
  if (!p || p.med.length < 3) return null;
  const W = 720;
  const H = 300;
  const pad = { l: 46, r: 16, t: 20, b: 34 };
  const lo = Math.min(...p.med, 1 - st.yield_med) - 0.006;
  const hi = Math.max(...p.med, 1) + 0.006;
  const x = (k: number) => pad.l + ((k - p.k[0]) / (p.k[p.k.length - 1] - p.k[0])) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const line = p.med.map((v, i) => `${i ? "L" : "M"}${x(p.k[i]).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const i0 = p.k.indexOf(0);
  const exV = p.med[i0];
  const back = p.k.findIndex((k, i) => k > 0 && p.med[i] >= 1);
  const ticks = [lo + 0.006, (lo + hi) / 2, hi - 0.006];
  const area = `${line}L${x(p.k[p.k.length - 1]).toFixed(1)},${(H - pad.b).toFixed(1)}L${x(p.k[0]).toFixed(1)},${(H - pad.b).toFixed(1)}Z`;
  const pctL = (v: number) => `${((v - 1) * 100).toFixed(1).replace(".", lang === "id" ? "," : ".")}%`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={tx({ id: "Gerak harga di sekitar ex-dividen", en: "Price around the ex-dividend date" })}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={C.grid} />
          <text x={pad.l - 8} y={y(t) + 3} textAnchor="end" fontSize={10} fill={C.muted}>{pctL(t)}</text>
        </g>
      ))}
      <defs>
        <linearGradient id="exd-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={C.current} stopOpacity={0.22} />
          <stop offset="100%" stopColor={C.current} stopOpacity={0} />
        </linearGradient>
      </defs>
      <motion.path d={area} fill="url(#exd-fill)" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.6 }} />
      <line x1={pad.l} x2={W - pad.r} y1={y(1)} y2={y(1)} stroke={C.ink2} strokeDasharray="5 5" strokeWidth={1} />
      <text x={W - pad.r} y={y(1) - 6} textAnchor="end" fontSize={10.5} fill={C.ink2}>{tx({ id: "harga cum (masih dapat dividen)", en: "cum price (with dividend)" })}</text>
      <line x1={pad.l} x2={W - pad.r} y1={y(1 - st.yield_med)} y2={y(1 - st.yield_med)} stroke="#7fd4a8" strokeDasharray="2 4" strokeWidth={1} opacity={0.7} />
      <text x={W - pad.r} y={y(1 - st.yield_med) + 14} textAnchor="end" fontSize={10.5} fill="#7fd4a8">{tx({ id: `kalau turun persis sebesar dividen (${pct(st.yield_med, 1)})`, en: `a drop exactly the dividend (${pct(st.yield_med, 1)})` })}</text>
      <line x1={x(0)} x2={x(0)} y1={pad.t} y2={H - pad.b} stroke={C.warn} strokeWidth={1} opacity={0.6} />
      <text x={x(0) + 6} y={pad.t + 10} fontSize={10.5} fill={C.warn}>ex-date</text>
      <motion.path d={line} fill="none" stroke={C.current} strokeWidth={2.5} initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: EASE }} />
      <motion.g initial={{ opacity: 0, scale: 0.6 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.7, duration: 0.3 }}>
        <circle cx={x(0)} cy={y(exV)} r={5} fill={C.down} stroke="#070b14" strokeWidth={2} />
        <text x={x(0) + 9} y={y(exV) + 16} fontSize={11.5} fontWeight={600} fill={C.down}>{pctL(exV)}</text>
      </motion.g>
      {back > 0 && (
        <motion.g initial={{ opacity: 0, scale: 0.6 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 1.0, duration: 0.3 }}>
          <circle cx={x(p.k[back])} cy={y(p.med[back])} r={5} fill="#7fd4a8" stroke="#070b14" strokeWidth={2} />
          <text x={x(p.k[back])} y={y(p.med[back]) - 10} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="#7fd4a8">
            {tx({ id: `pulih hari ke-${p.k[back]}`, en: `back by day ${p.k[back]}` })}
          </text>
        </motion.g>
      )}
      {[p.k[0], 0, 5, 10, 15, p.k[p.k.length - 1]].map((k) => (
        <text key={k} x={x(k)} y={H - 12} textAnchor="middle" fontSize={10} fill={C.muted}>{k === 0 ? "0" : k > 0 ? `+${k}` : k}</text>
      ))}
      <text x={(W + pad.l) / 2} y={H - 1} textAnchor="middle" fontSize={10} fill={C.muted}>{tx({ id: "hari bursa dari ex-date", en: "trading days from the ex-date" })}</text>
    </svg>
  );
}

/* ------------------------------------------------------------- month calendar */
function MonthCalendar({ items, ranked, asOf }: { items: AgendaItem[]; ranked: Set<string>; asOf: string }) {
  const { tx, lang } = useLang();
  const detail = useAgendaDetail();
  const months = useMemo(() => [...new Set(items.map((it) => it.date.slice(0, 7)))].sort(), [items]);
  const [month, setMonth] = useState(months[0] ?? asOf.slice(0, 7));
  const byDay = useMemo(() => {
    const m = new Map<string, AgendaItem[]>();
    for (const it of items) m.set(it.date, [...(m.get(it.date) ?? []), it]);
    return m;
  }, [items]);
  const firstWithItems = (mo: string) => [...byDay.keys()].filter((d) => d.startsWith(mo)).sort()[0] ?? null;
  const [day, setDay] = useState<string | null>(firstWithItems(month));
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const days = new Date(y, m, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 5 + i).toLocaleDateString(lang === "id" ? "id-ID" : "en-GB", { weekday: "short" }));
  const list = day ? byDay.get(day) ?? [] : [];
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5">
        <div className="flex flex-wrap gap-1.5">
          {months.map((mo) => (
            <button
              key={mo}
              onClick={() => {
                setMonth(mo);
                setDay(firstWithItems(mo));
              }}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-[13px] transition-colors duration-150 ${mo === month ? "bg-raised text-ink ring-1 ring-line-strong" : "text-muted hover:text-ink-2"}`}
            >
              {new Date(mo + "-01T00:00:00").toLocaleDateString(lang === "id" ? "id-ID" : "en-GB", { month: "long", year: "numeric" })}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] text-muted">
          {weekdays.map((w) => (
            <div key={w} className="pb-1">{w}</div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`x${i}`} />;
            const its = byDay.get(d) ?? [];
            const types = [...new Set(its.map((it) => it.type))];
            const active = d === day;
            return (
              <button
                key={d}
                disabled={!its.length}
                onClick={() => setDay(d)}
                aria-pressed={active}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-[13px] transition-colors duration-150 ${
                  active ? "bg-arus/15 text-ink ring-1 ring-arus/60" : its.length ? "cursor-pointer bg-ground/60 text-ink-2 ring-1 ring-line hover:ring-line-strong" : "text-muted/50"
                } ${d <= asOf ? "opacity-50" : ""}`}
              >
                <span className="num">{Number(d.slice(8))}</span>
                {its.length > 0 && (
                  <span className="mt-1 flex gap-0.5">
                    {types.slice(0, 3).map((t) => (
                      <span key={t} className="h-1.5 w-1.5 rounded-full" style={{ background: TYPE_STYLE[t].color }} />
                    ))}
                  </span>
                )}
                {its.length > 1 && <span className="num absolute right-1 top-0.5 text-[9.5px] text-muted">{its.length}</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-[11.5px] text-muted">
          {(["dividend", "agm", "right_issue", "stock_split", "warrant"] as AgendaType[]).map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: TYPE_STYLE[t].color }} />
              {tx(AGENDA_LABEL[t].label)}
            </span>
          ))}
        </div>
      </div>
      <div>
        <AnimatePresence mode="wait">
          <motion.div key={day ?? "none"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ duration: 0.25, ease: EASE }}>
            <div className="text-[15px] font-semibold text-ink">{day ? dateLabel(day, lang, { weekday: "long" }) : tx({ id: "Pilih tanggal", en: "Pick a date" })}</div>
            <ul className="mt-3 space-y-2">
              {list.map((it) => (
                <li key={`${it.type}-${it.s}`} className="flex items-start gap-3 rounded-xl bg-surface px-4 py-3 ring-1 ring-line">
                  <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ring-1 ${TYPE_STYLE[it.type].bg}`} style={{ color: TYPE_STYLE[it.type].color }}>
                    {TYPE_STYLE[it.type].icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <Sym s={it.s} ranked={ranked.has(it.s)} className="text-[15px] font-semibold text-ink" />
                      <span className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: TYPE_STYLE[it.type].color }}>{tx(AGENDA_LABEL[it.type].label)}</span>
                    </div>
                    <div className="truncate text-[12px] text-muted">{shortName(it.name)}</div>
                    <div className="num mt-1 text-[12.5px] text-ink-2">{detail(it)}</div>
                    {it.type === "agm" && it.place && <div className="mt-0.5 truncate text-[11.5px] text-muted">{it.place}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- rights issues */
function RightsCards({ items, ranked }: { items: AgendaItem[]; ranked: Set<string> }) {
  const { tx, lang } = useLang();
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((it, i) => (
        <motion.article key={`${it.s}-${it.date}`} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35, delay: i * 0.05, ease: EASE }} className="rounded-2xl bg-surface p-5 ring-1 ring-line">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Sym s={it.s} ranked={ranked.has(it.s)} className="text-xl font-semibold text-ink" />
              <div className="text-[12px] text-muted">{shortName(it.name)}</div>
            </div>
            <span className="num rounded-full bg-warn/10 px-2.5 py-1 text-[12px] font-semibold text-warn ring-1 ring-warn/30">
              {it.old}:{it.new} @ Rp{price(it.price, lang)}
            </span>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-[12px] text-ink-2">
              <span>{tx({ id: "Porsimu kalau tidak menebus", en: "Your stake if you skip" })}</span>
              <span className="num font-semibold text-[#f0a3a3]">−{pct(it.dilution, 0)}</span>
            </div>
            <div className="mt-1.5 flex h-3 overflow-hidden rounded-full bg-raised">
              <motion.div className="h-full bg-arus/70" initial={{ width: "100%" }} whileInView={{ width: `${(1 - (it.dilution ?? 0)) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE }} />
              <div className="h-full flex-1 bg-warn/60" />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted">
              <span>{tx({ id: "kepemilikanmu", en: "your stake" })}</span>
              <span>{tx({ id: "saham baru", en: "new shares" })}</span>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-[12px]">
            <div>
              <dt className="text-muted">{tx({ id: "Harga tebus vs kini", en: "Price vs now" })}</dt>
              <dd className="num text-ink">{it.discount != null ? signed(it.discount * 100, 0, "%") : "–"}</dd>
            </div>
            <div>
              <dt className="text-muted">{tx({ id: "Cum date", en: "Cum date" })}</dt>
              <dd className="num text-ink">{it.cum ? dateLabel(it.cum, lang, { year: undefined }) : "–"}</dd>
            </div>
            <div>
              <dt className="text-muted">{tx({ id: "Perdagangan HMETD", en: "Rights trading" })}</dt>
              <dd className="num text-ink">{it.trade_from && it.trade_to ? `${dateLabel(it.trade_from, lang, { year: undefined })}–${dateLabel(it.trade_to, lang, { year: undefined })}` : "–"}</dd>
            </div>
          </dl>
        </motion.article>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- page */
export function AgendaView({ book, ranked }: { book: AgendaBook; ranked: string[] }) {
  const { tx } = useLang();
  const isRanked = useMemo(() => new Set(ranked), [ranked]);
  const today = useToday();
  const st = "n" in book.study ? (book.study as DividendStudy) : null;
  // once the visitor's date is known, anything whose date has passed drops out of the lists
  const up = today == null ? book.upcoming : book.upcoming.filter((it) => toDay(it.date) >= today);
  const count = (t: AgendaType) => up.filter((it) => it.type === t).length;
  const key = up.filter((it) => it.type !== "agm");
  const soon = [...key, ...up.filter((it) => it.type === "agm" && isRanked.has(it.s))].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  const divs = up.filter((it) => it.type === "dividend");
  const rights = up.filter((it) => it.type === "right_issue");

  return (
    <div className="pt-7 sm:pt-9">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="max-w-3xl">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-balance sm:text-[2.4rem]">
          <T id="Tanggal-tanggal yang menggerakkan harga" en="The dates that move prices" />
        </h1>
        <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-ink-2 sm:text-[15.5px]">
          <T
            id="Dividen, RUPS, rights issue, dan stock split dalam satu kalender: kapan terakhir beli, berapa yield-nya dari harga sekarang, seberapa besar kepemilikanmu terencerkan, dan apa yang biasanya terjadi pada harga."
            en="Dividends, AGMs, rights issues and splits in one calendar: the last day to buy, the yield at today's price, how much your stake gets diluted, and what usually happens to the price."
          />
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {(["dividend", "agm", "right_issue", "stock_split", "warrant"] as AgendaType[])
            .filter((t) => count(t) > 0)
            .map((t) => (
              <span key={t} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] ring-1 ${TYPE_STYLE[t].bg}`} style={{ color: TYPE_STYLE[t].color }}>
                {TYPE_STYLE[t].icon}
                <span className="num font-semibold">{count(t)}</span>
                {tx(AGENDA_LABEL[t].label)}
              </span>
            ))}
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] text-muted ring-1 ring-line">
            <CalendarDays size={14} />
            {tx({ id: "90 hari ke depan", en: "next 90 days" })}
          </span>
        </div>
      </motion.header>

      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          <T id="Paling dekat" en="Coming up first" />
        </h2>
        <div className="mt-5">
          <Soon items={soon} ranked={isRanked} today={today} />
        </div>
      </section>

      {divs.length > 0 && (
        <section className="mt-11">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            <T id="Dividen, dari yield tertinggi" en="Dividends, highest yield first" />
          </h2>
          <p className="mt-1.5 max-w-[70ch] text-[13.5px] text-muted">
            <T id="Yield dihitung dari harga penutupan terakhir. Untuk berhak, saham harus sudah dibeli paling lambat di cum date." en="Yield at the latest close. To qualify, the shares must be bought by the cum date." />
          </p>
          <div className="mt-5">
            <DividendBoard items={divs} ranked={isRanked} today={today} />
          </div>
        </section>
      )}

      {st && (
        <section className="mt-11 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-center">
          <div className="rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5">
            <ExDividendChart st={st} />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              <T id="Beli demi dividen, untung?" en="Buying for the dividend: does it pay?" />
            </h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">
              {tx({
                id: `Garis biru adalah gerak harga median dari ${st.path?.n ?? st.n} dividen di BEI, 5 hari sebelum sampai 20 hari sesudah ex-date. Di hari ex, harga turun hampir sebesar dividennya (rata-rata ${pct(st.drop_ratio_med, 0)} dari dividen), jadi membeli tepat sebelum cum date biasanya impas.`,
                en: `The blue line is the median price path of ${st.path?.n ?? st.n} IDX dividends, from 5 days before to 20 days after the ex-date. On the ex-date the price drops by most of the dividend (${pct(st.drop_ratio_med, 0)} of it on average), so buying just before the cum date tends to break even.`,
              })}
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-3">
              {[
                [pct(st.yield_med, 1), tx({ id: "yield median", en: "median yield" }), "text-ink"],
                [signed(st.move_med * 100, 1, "%"), tx({ id: "gerak di hari ex", en: "move on the ex-date" }), "text-down"],
                [pct(st.recovered_share, 0), tx({ id: `pulih dalam ${st.within} hari`, en: `back within ${st.within} days` }), "text-[#7fd4a8]"],
                [String(st.n), tx({ id: "dividen diamati", en: "dividends studied" }), "text-ink"],
              ].map(([v, l, t]) => (
                <div key={l} className="rounded-xl bg-surface px-3.5 py-3 ring-1 ring-line">
                  <dd className={`num text-xl font-semibold ${t}`}>{v}</dd>
                  <dt className="text-[11.5px] text-muted">{l}</dt>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      <section className="mt-11">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          <T id="Kalender" en="Calendar" />
        </h2>
        <p className="mt-1.5 text-[13.5px] text-muted">
          <T id="Klik tanggal bertitik untuk melihat agendanya." en="Click a dotted date to see what's on." />
        </p>
        <div className="mt-5">
          <MonthCalendar items={book.upcoming} ranked={isRanked} asOf={book.as_of} />
        </div>
      </section>

      {rights.length > 0 && (
        <section className="mt-11">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            <T id="Rights issue: seberapa besar porsimu terencerkan" en="Rights issues: how much your stake gets diluted" />
          </h2>
          <div className="mt-5">
            <RightsCards items={rights} ranked={isRanked} />
          </div>
        </section>
      )}

      <p className="mt-10 max-w-[75ch] text-[13px] leading-relaxed text-muted">
        <T
          id="Kalender aksi korporasi dari Sectors. Yield dihitung dari harga penutupan terakhir. Jadwal bisa berubah; cek keterbukaan informasi emiten sebelum bertransaksi. Informasi, bukan nasihat keuangan."
          en="Corporate-action calendar from Sectors. Yield uses the latest close. Schedules can change; check the company's disclosure before trading. Information, not financial advice."
        />
      </p>
    </div>
  );
}

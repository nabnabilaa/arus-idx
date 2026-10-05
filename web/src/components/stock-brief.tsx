"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check, Copy, Download, GitCompareArrows, Minus, Send, Star } from "lucide-react";
import { useState } from "react";
import { AGENDA_LABEL } from "@/lib/agenda";
import { SECTOR_ID, SUBSECTOR_ID } from "@/lib/features";
import { dateLabel, idr, pct } from "@/lib/format";
import { useLang, type Bi } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { RISK, riskFlags } from "@/lib/risk";
import type { AgendaItem, Stock } from "@/lib/types";

const EASE = [0.23, 1, 0.32, 1] as const;
const BOT = "nab_arus_bot";

type Tone = "good" | "bad" | "neutral";
type Point = { tone: Tone; text: Bi; weight: number };

const x2 = (v: number | null | undefined, lang: "id" | "en") =>
  v == null ? "–" : `${v.toLocaleString(lang === "id" ? "id-ID" : "en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}×`;

/** Plain sentences about where this stock stands, strongest signal first, never more than five. */
function points(s: Stock, agenda: AgendaItem[]): Point[] {
  const out: Point[] = [];
  const share = (p: number) => Math.round(p * 100);
  if (s.pct_value != null) {
    if (s.pct_value >= 0.7)
      out.push({ tone: "good", weight: s.pct_value, text: { id: `Lebih murah dari ${share(s.pct_value)}% sesama subsektor (PER ${x2(s.pe_ttm, "id")}, PBV ${x2(s.pb_mrq, "id")}).`, en: `Cheaper than ${share(s.pct_value)}% of sub-sector peers (P/E ${x2(s.pe_ttm, "en")}, P/B ${x2(s.pb_mrq, "en")}).` } });
    else if (s.pct_value <= 0.3)
      out.push({ tone: "bad", weight: 1 - s.pct_value, text: { id: `Lebih mahal dari kebanyakan sesama subsektor (PER ${x2(s.pe_ttm, "id")}, PBV ${x2(s.pb_mrq, "id")}).`, en: `Pricier than most sub-sector peers (P/E ${x2(s.pe_ttm, "en")}, P/B ${x2(s.pb_mrq, "en")}).` } });
  }
  if (s.pct_quality != null) {
    if (s.pct_quality >= 0.7)
      out.push({ tone: "good", weight: s.pct_quality, text: { id: `Kualitas bisnis di atas ${share(s.pct_quality)}% sesamanya (ROE ${pct(s.roe_ttm, 1)}).`, en: `Business quality above ${share(s.pct_quality)}% of peers (ROE ${pct(s.roe_ttm, 1)}).` } });
    else if (s.pct_quality <= 0.3)
      out.push({ tone: "bad", weight: 1 - s.pct_quality, text: { id: `Kualitas bisnis di bawah kebanyakan sesamanya (ROE ${pct(s.roe_ttm, 1)}).`, en: `Business quality below most peers (ROE ${pct(s.roe_ttm, 1)}).` } });
  }
  if (s.pct_growth != null && (s.pct_growth >= 0.75 || s.pct_growth <= 0.25))
    out.push({
      tone: s.pct_growth >= 0.75 ? "good" : "bad",
      weight: Math.abs(s.pct_growth - 0.5) * 2,
      text: s.pct_growth >= 0.75 ? { id: "Laba dan pendapatan kuartalan tumbuh lebih cepat dari kebanyakan sesamanya.", en: "Quarterly profit and revenue growing faster than most peers." } : { id: "Laba dan pendapatan kuartalan tumbuh lebih lambat dari kebanyakan sesamanya.", en: "Quarterly profit and revenue growing slower than most peers." },
    });
  if (s.ff_net_20 != null && Math.abs(s.ff_net_20) >= 1e9)
    out.push({
      tone: s.ff_net_20 > 0 ? "good" : "bad",
      weight: 0.75,
      text: s.ff_net_20 > 0 ? { id: `Asing membeli bersih ${idr(s.ff_net_20, "id")} sebulan terakhir.`, en: `Foreigners net bought ${idr(s.ff_net_20, "en")} over the past month.` } : { id: `Asing menjual bersih ${idr(-s.ff_net_20, "id")} sebulan terakhir.`, en: `Foreigners net sold ${idr(-s.ff_net_20, "en")} over the past month.` },
    });
  if (s.insider_net_val != null && Math.abs(s.insider_net_val) >= 1e9)
    out.push({
      tone: s.insider_net_val > 0 ? "good" : "bad",
      weight: 0.7,
      text: s.insider_net_val > 0 ? { id: `Orang dalam membeli bersih ${idr(s.insider_net_val, "id")} di pasar (90 hari).`, en: `Insiders net bought ${idr(s.insider_net_val, "en")} on the market (90 days).` } : { id: `Orang dalam menjual bersih ${idr(-s.insider_net_val, "id")} di pasar (90 hari).`, en: `Insiders net sold ${idr(-s.insider_net_val, "en")} on the market (90 days).` },
    });
  if (s.pos_52w != null && (s.pos_52w >= 0.9 || s.pos_52w <= 0.1))
    out.push({
      tone: "neutral",
      weight: 0.6,
      text: s.pos_52w >= 0.9 ? { id: "Harga dekat puncak setahun terakhir.", en: "Price near its one-year high." } : { id: "Harga dekat titik terendah setahun terakhir.", en: "Price near its one-year low." },
    });
  const next = agenda[0];
  if (next)
    out.push({
      tone: "neutral",
      weight: 0.9,
      text: {
        id: `${AGENDA_LABEL[next.type].label.id} ${dateLabel(next.date, "id", { year: undefined })}${next.type === "dividend" && next.yield != null ? `, yield ${pct(next.yield, 1)}` : ""}.`,
        en: `${AGENDA_LABEL[next.type].label.en} ${dateLabel(next.date, "en", { year: undefined })}${next.type === "dividend" && next.yield != null ? `, yield ${pct(next.yield, 1)}` : ""}.`,
      },
    });
  const flags = riskFlags(s.risk_flags);
  if (flags.length)
    out.push({ tone: "bad", weight: 1.1, text: { id: `Tanda risiko: ${flags.map((f) => RISK[f].label.id.toLowerCase()).join(", ")}.`, en: `Risk flags: ${flags.map((f) => RISK[f].label.en.toLowerCase()).join(", ")}.` } });
  return out.sort((a, b) => b.weight - a.weight).slice(0, 5);
}

const TONE: Record<Tone, { icon: React.ReactNode; cls: string }> = {
  good: { icon: <ArrowUpRight size={14} />, cls: "bg-aqua/12 text-[#7fd4a8]" },
  bad: { icon: <ArrowDownRight size={14} />, cls: "bg-down/12 text-[#f0a3a3]" },
  neutral: { icon: <Minus size={14} />, cls: "bg-raised text-ink-2" },
};

function Action({ href, onClick, icon, label, active = false, download }: { href?: string; onClick?: () => void; icon: React.ReactNode; label: string; active?: boolean; download?: string }) {
  const cls = `inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[13px] ring-1 transition-colors duration-150 ${
    active ? "bg-warn/10 text-warn ring-warn/40" : "bg-surface text-ink-2 ring-line hover:text-ink hover:ring-line-strong"
  }`;
  if (href)
    return href.startsWith("http") ? (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {icon}
        {label}
      </a>
    ) : download ? (
      <a href={href} download={download} className={cls}>
        {icon}
        {label}
      </a>
    ) : (
      <Link href={href} className={cls}>
        {icon}
        {label}
      </Link>
    );
  return (
    <button onClick={onClick} className={cls}>
      {icon}
      {label}
    </button>
  );
}

/** Under the stock header: what to do with it, the short read, and the company at a glance. */
export function StockBrief({ s, agenda, peers, capRank, total }: { s: Stock; agenda: AgendaItem[]; peers: string[]; capRank: number | null; total: number }) {
  const { tx, lang } = useLang();
  const { isWatched, toggleWatch } = usePrefs();
  const [copied, setCopied] = useState(false);
  const watched = isWatched(s.symbol);
  const pts = points(s, agenda);
  const sub = s.sub_sector ? (lang === "id" ? SUBSECTOR_ID[s.sub_sector] ?? s.sub_sector : s.sub_sector) : "–";
  const sec = s.sector ? (lang === "id" ? SECTOR_ID[s.sector] ?? s.sector : s.sector) : "–";
  const facts: [string, React.ReactNode][] = [
    [tx({ id: "Sektor", en: "Sector" }), sec],
    [tx({ id: "Subsektor", en: "Sub-sector" }), sub],
    [tx({ id: "Kapitalisasi", en: "Market cap" }), <span key="c">{idr(s.market_cap, lang)}{capRank ? <span className="ml-1 text-[11.5px] text-muted">#{capRank}/{total}</span> : null}</span>],
    [tx({ id: "Dividen yield", en: "Dividend yield" }), pct(s.yield_ttm, 1)],
    ["PER · PBV", `${x2(s.pe_ttm, lang)} · ${x2(s.pb_mrq, lang)}`],
    ["ROE", pct(s.roe_ttm, 1)],
  ];
  const copy = () => {
    try {
      void navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05, ease: EASE }} className="mt-4">
      <div className="flex flex-wrap gap-2">
        <Action onClick={() => toggleWatch(s.symbol)} active={watched} icon={<Star size={15} className={watched ? "fill-warn" : ""} />} label={watched ? tx({ id: "Dipantau", en: "Watching" }) : tx({ id: "Pantau", en: "Watch" })} />
        <Action href={`https://t.me/${BOT}?start=pantau_${s.symbol}`} icon={<Send size={15} />} label={tx({ id: "Peringatan Telegram", en: "Telegram alerts" })} />
        {peers.length > 0 && <Action href={`/bandingkan/?s=${[s.symbol, ...peers.slice(0, 2)].join(",")}`} icon={<GitCompareArrows size={15} />} label={tx({ id: `Bandingkan dengan ${peers.slice(0, 2).join(" & ")}`, en: `Compare with ${peers.slice(0, 2).join(" & ")}` })} />}
        <Action href={`/saham/${s.symbol}/opengraph-image`} download={`arus-${s.symbol}.png`} icon={<Download size={15} />} label={tx({ id: "Unduh kartu", en: "Download card" })} />
        <Action onClick={copy} icon={copied ? <Check size={15} className="text-[#7fd4a8]" /> : <Copy size={15} />} label={copied ? tx({ id: "Tautan tersalin", en: "Link copied" }) : tx({ id: "Salin tautan", en: "Copy link" })} />
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
          <h2 className="text-[15px] font-semibold text-ink">{tx({ id: "Singkatnya", en: "In short" })}</h2>
          <ul className="mt-3 space-y-2.5">
            {pts.map((p, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: 0.1 + i * 0.05, ease: EASE }} className="flex gap-3 text-[14px] leading-snug text-ink-2">
                <span className={`mt-px grid h-6 w-6 shrink-0 place-items-center rounded-full ${TONE[p.tone].cls}`}>{p.tone === "bad" && p.text.id.startsWith("Tanda") ? <AlertTriangle size={13} /> : TONE[p.tone].icon}</span>
                <span className="pt-0.5">{tx(p.text)}</span>
              </motion.li>
            ))}
            {pts.length === 0 && <li className="text-[14px] text-muted">{tx({ id: "Tidak ada yang menonjol dibanding sesama subsektornya.", en: "Nothing stands out against its sub-sector peers." })}</li>}
          </ul>
        </div>
        <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
          <h2 className="text-[15px] font-semibold text-ink">{tx({ id: "Profil singkat", en: "At a glance" })}</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
            {facts.map(([l, v]) => (
              <div key={l} className="min-w-0">
                <dt className="text-[11.5px] text-muted">{l}</dt>
                <dd className="num truncate text-[14px] text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {s.pos_52w != null && (
            <div className="mt-4">
              <div className="flex justify-between text-[11.5px] text-muted">
                <span>{tx({ id: "Posisi di rentang setahun", en: "Position in its 1-year range" })}</span>
                <span className="num text-ink-2">{Math.round(s.pos_52w * 100)}%</span>
              </div>
              <div className="relative mt-1.5 h-2 rounded-full bg-gradient-to-r from-down/40 via-raised to-up/50">
                <motion.span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-[3px] ring-surface" initial={{ left: "50%" }} animate={{ left: `${Math.min(100, Math.max(0, s.pos_52w * 100))}%` }} transition={{ type: "spring", stiffness: 200, damping: 22 }} />
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-muted">
                <span>{tx({ id: "terendah", en: "low" })}</span>
                <span>{tx({ id: "tertinggi", en: "high" })}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}

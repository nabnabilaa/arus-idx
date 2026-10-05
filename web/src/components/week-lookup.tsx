"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { idr, signed } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { IDX_SECTOR_EN } from "@/lib/weekly";
import type { WeeklyRecap } from "@/lib/types";

const EASE = [0.23, 1, 0.32, 1] as const;
const short = (n: string | null | undefined) => (n ?? "").replace(/^PT\.? /, "");

/** "How did my stock do this week?" — any traded IDX stock, against the market and its sector. */
export function WeekLookup({ w, ranked }: { w: WeeklyRecap; ranked: Set<string> }) {
  const { tx, lang } = useLang();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const syms = useMemo(() => Object.keys(w.lookup ?? {}), [w.lookup]);
  const query = q.trim().toUpperCase();
  const hits = query
    ? syms
        .filter((s) => s.startsWith(query) || short(w.names[s]).toUpperCase().includes(query))
        .sort((a, b) => Number(!a.startsWith(query)) - Number(!b.startsWith(query)) || a.localeCompare(b))
        .slice(0, 6)
    : [];
  const row = sel ? w.lookup[sel] : null;
  const pctS = (x: number | null | undefined) => signed(x == null ? null : x * 100, 1, "%");
  const sector = row?.[3] ?? null;
  const secMed = sector ? w.sector_med?.[sector] : undefined;
  const beat = row ? Math.round(row[4] * 100) : null;
  const pick = (s: string) => {
    setSel(s);
    setQ("");
  };
  return (
    <section className="mt-10 rounded-2xl bg-surface p-5 ring-1 ring-line sm:p-6">
      <h2 className="text-[16px] font-semibold text-ink">{tx({ id: "Bagaimana sahammu pekan ini?", en: "How did your stock do this week?" })}</h2>
      <p className="mt-0.5 text-[12.5px] text-muted">
        {tx({ id: `Cari di antara ${syms.length} saham yang diperdagangkan pekan ini.`, en: `Search the ${syms.length} stocks that traded this week.` })}
      </p>
      <div className="relative mt-4 max-w-xl">
        <label className="flex h-11 items-center gap-3 rounded-xl bg-ground/60 px-4 ring-1 ring-line-strong focus-within:ring-arus/70">
          <Search size={16} className="shrink-0 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && hits[0]) pick(hits[0]);
            }}
            placeholder={tx({ id: "Kode atau nama, misal BBRI atau Telkom", en: "Ticker or name, e.g. BBRI or Telkom" })}
            aria-label={tx({ id: "Cari saham di rekap pekan", en: "Search a stock in the weekly recap" })}
            className="w-full bg-transparent text-[14.5px] text-ink placeholder:text-muted focus:outline-none"
          />
        </label>
        {hits.length > 0 && (
          <ul className="absolute inset-x-0 top-12 z-30 overflow-hidden rounded-xl bg-raised ring-1 ring-line-strong shadow-[0_20px_50px_-12px_rgb(0_0_0/0.8)]">
            {hits.map((s) => (
              <li key={s}>
                <button onClick={() => pick(s)} className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-surface">
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">{s}</span> <span className="text-[13px] text-muted">{short(w.names[s])}</span>
                  </span>
                  <span className={`num shrink-0 text-[13px] ${w.lookup[s][0] >= 0 ? "text-up" : "text-down"}`}>{pctS(w.lookup[s][0])}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <AnimatePresence mode="wait">
        {sel && row && (
          <motion.div key={sel} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ duration: 0.25, ease: EASE }} className="mt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <span className="text-2xl font-semibold tracking-tight text-ink">{sel}</span>
                <span className="ml-2 text-[13px] text-muted">{short(w.names[sel])}</span>
              </div>
              {ranked.has(sel) && (
                <Link href={`/saham/${sel}/`} className="inline-flex items-center gap-1 text-[13px] text-arus hover:underline">
                  {tx({ id: "Buka halaman saham", en: "Open stock page" })} <ArrowUpRight size={14} />
                </Link>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [tx({ id: "Harga sepekan", en: "Price, week" }), pctS(row[0]), row[0] >= 0 ? "text-up" : "text-down"],
                [tx({ id: "vs IHSG", en: "vs IHSG" }), w.stats.ihsg != null ? signed((row[0] - w.stats.ihsg) * 100, 1, lang === "id" ? " poin" : " pts") : "–", row[0] - (w.stats.ihsg ?? 0) >= 0 ? "text-up" : "text-down"],
                [tx({ id: "Asing bersih", en: "Foreign net" }), idr(row[1], lang), row[1] >= 0 ? "text-up" : "text-down"],
                [tx({ id: "Nilai transaksi", en: "Value traded" }), idr(row[2], lang), "text-ink"],
              ].map(([l, v, t]) => (
                <div key={l} className="rounded-xl bg-ground/60 px-3.5 py-3 ring-1 ring-line">
                  <div className="text-[11.5px] text-muted">{l}</div>
                  <div className={`num mt-0.5 text-lg font-semibold ${t}`}>{v}</div>
                </div>
              ))}
            </div>
            {beat != null && (
              <div className="mt-4">
                <div className="flex flex-wrap justify-between gap-2 text-[12.5px] text-ink-2">
                  <span>{tx({ id: `Lebih baik dari ${beat}% saham di BEI pekan ini`, en: `Did better than ${beat}% of IDX stocks this week` })}</span>
                  {sector && secMed != null && (
                    <span className="text-muted">
                      {tx({ id: `Median sektor ${sector}: ${pctS(secMed)}`, en: `${IDX_SECTOR_EN[sector] ?? sector} median: ${pctS(secMed)}` })}
                    </span>
                  )}
                </div>
                <div className="relative mt-2 h-2.5 rounded-full bg-gradient-to-r from-down/50 via-raised to-up/60">
                  <motion.span
                    className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-4 ring-ground"
                    initial={{ left: "50%" }}
                    animate={{ left: `${beat}%` }}
                    transition={{ type: "spring", stiffness: 200, damping: 22 }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-muted">
                  <span>{tx({ id: "terburuk", en: "worst" })}</span>
                  <span>{tx({ id: "terbaik", en: "best" })}</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

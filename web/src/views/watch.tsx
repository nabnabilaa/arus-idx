"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Bell, GitCompareArrows, Star } from "lucide-react";
import { FIN_GRADE } from "@/components/perspectives";
import { StarButton } from "@/components/ui";
import { alertsFor } from "@/lib/alerts";
import { dateLabel, idr, price, signed } from "@/lib/format";
import { T, useLang } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import type { CompactStock } from "@/lib/types";
import { VERDICT, verdictOf } from "@/lib/verdict";

const EASE = [0.23, 1, 0.32, 1] as const;

export function Sparkline({ v, w = 110, h = 32 }: { v: number[]; w?: number; h?: number }) {
  if (v.length < 2) return null;
  const lo = Math.min(...v), hi = Math.max(...v);
  const up = v[v.length - 1] >= v[0];
  const d = v.map((x, i) => `${i ? "L" : "M"} ${(i / (v.length - 1)) * w} ${h - 2 - ((x - lo) / (hi - lo || 1)) * (h - 4)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={d} fill="none" stroke={up ? "#5cc8ff" : "#e66767"} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

/** The starred stocks, each with today's state and anything worth a second look. */
export function WatchView({ stocks, asOf, total }: { stocks: CompactStock[]; asOf: string; total: number }) {
  const { tx, lang } = useLang();
  const { watchlist } = usePrefs();
  const mine = watchlist.map((s) => stocks.find((x) => x.symbol === s)).filter(Boolean) as CompactStock[];
  const withAlerts = mine.filter((s) => alertsFor(s).length > 0);

  return (
    <div className="pt-10 sm:pt-12">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="max-w-3xl">
        <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-balance sm:text-5xl">
          <T id="Pantauanku" en="My watchlist" />
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
          {tx({
            id: `Saham yang kamu beri bintang, dengan kondisi per ${dateLabel(asOf, "id")} dan peringatan kalau ada yang perlu dilihat ulang. Daftar ini tersimpan di browser ini saja. Untuk notifikasi otomatis, pantau juga lewat bot Telegram (/pantau KODE).`,
            en: `The stocks you starred, as of ${dateLabel(asOf, "en")}, with alerts when something deserves a second look. This list lives in this browser only. For automatic pings, also watch them in the Telegram bot (/pantau CODE).`,
          })}
        </p>
      </motion.header>

      {mine.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-surface p-8 text-center ring-1 ring-line">
          <Star size={28} className="mx-auto text-muted" />
          <p className="mt-3 text-[15px] text-ink">
            <T id="Belum ada saham yang dipantau." en="Nothing on your watchlist yet." />
          </p>
          <p className="mt-1 text-[13.5px] text-muted">
            {tx({ id: `Klik ikon ★ di samping saham mana pun (${total} saham tersedia), atau tekan Ctrl+K untuk mencari.`, en: `Click the ★ next to any stock (${total} available), or press Ctrl+K to search.` })}
          </p>
          <Link href="/#semua" className="mt-5 inline-flex rounded-lg bg-arus px-4 py-2 text-[13.5px] font-semibold text-ground">
            <T id="Pilih dari semua saham" en="Pick from all stocks" />
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-[13px] text-ink-2 ring-1 ring-line">
              <Bell size={14} className={withAlerts.length ? "text-warn" : "text-muted"} />
              {tx({ id: `${withAlerts.length} dari ${mine.length} saham punya peringatan hari ini`, en: `${withAlerts.length} of ${mine.length} stocks have alerts today` })}
            </span>
            {mine.length >= 2 && (
              <Link href={`/bandingkan/?s=${mine.slice(0, 4).map((s) => s.symbol).join(",")}`} className="inline-flex items-center gap-2 rounded-full bg-arus/10 px-3 py-1.5 text-[13px] text-arus ring-1 ring-arus/40 hover:bg-arus/15">
                <GitCompareArrows size={14} />
                <T id="Bandingkan pantauan" en="Compare watchlist" />
              </Link>
            )}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {mine.map((s, i) => {
              const al = alertsFor(s);
              const v = verdictOf(s.q_1);
              const up = (s.ret_1 ?? 0) >= 0;
              return (
                <motion.div key={s.symbol} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.04, ease: EASE }} className="flex flex-col rounded-2xl bg-surface p-4 ring-1 ring-line">
                  <div className="flex items-start gap-2">
                    <StarButton symbol={s.symbol} />
                    <Link href={`/saham/${s.symbol}/`} className="min-w-0 flex-1">
                      <div className="text-[17px] font-semibold text-ink hover:text-arus">{s.symbol}</div>
                      <div className="truncate text-[12px] text-muted">{s.name}</div>
                    </Link>
                    <div className="text-right">
                      <div className="num text-[15px] text-ink">{price(s.price, lang)}</div>
                      <div className={`num text-[12.5px] ${up ? "text-up" : "text-down"}`}>{signed((s.ret_1 ?? 0) * 100, 1, "%")}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <Sparkline v={s.closes} />
                    <div className="text-right text-[12px]">
                      <div style={{ color: VERDICT[v].color }}>{tx(VERDICT[v].label)}</div>
                      {s.fin_grade && <div className={FIN_GRADE[s.fin_grade].tone}>{tx(FIN_GRADE[s.fin_grade].label)}</div>}
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                    <div className="rounded-lg bg-ground/60 px-2.5 py-2 ring-1 ring-line">
                      <dt className="text-muted">{tx({ id: "Rentang wajar 1 minggu", en: "1-week range" })}</dt>
                      <dd className="num text-ink">{s.week ? `${price(s.week[0], lang)} – ${price(s.week[1], lang)}` : "–"}</dd>
                    </div>
                    <div className="rounded-lg bg-ground/60 px-2.5 py-2 ring-1 ring-line">
                      <dt className="text-muted">{tx({ id: "Asing sebulan", en: "Foreign, 1 mo" })}</dt>
                      <dd className={`num ${(s.ff_net_20 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{idr(s.ff_net_20, lang)}</dd>
                    </div>
                  </dl>
                  <ul className="mt-3 space-y-1.5">
                    {al.length === 0 && <li className="text-[12.5px] text-muted">{tx({ id: "Tidak ada yang luar biasa hari ini.", en: "Nothing unusual today." })}</li>}
                    {al.map((a, k) => (
                      <li key={k} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] ring-1 ${a.tone === "up" ? "bg-up/10 text-[#9cc5f5] ring-up/30" : a.tone === "down" ? "bg-down/10 text-[#f0a3a3] ring-down/30" : "bg-warn/10 text-warn ring-warn/30"}`}>
                        <Bell size={12} />
                        {tx(a.text)}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

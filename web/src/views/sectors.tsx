"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Heatmap, SectorMap } from "@/components/charts/analytics";
import { Term } from "@/components/term";
import { SUBSECTOR_ID } from "@/lib/features";
import { idr, signed } from "@/lib/format";
import { T, useLang, type Bi } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import type { Bundle, Sector } from "@/lib/types";

const EASE = [0.23, 1, 0.32, 1] as const;

export function SectorsView({ sectors, sectorTs }: Pick<Bundle, "sectors" | "sectorTs">) {
  const { tx, lang } = useLang();
  const { horizon } = usePrefs();
  const [history, setHistory] = useState(false);
  const label = (s: string) => (lang === "id" ? SUBSECTOR_ID[s] ?? s : s);
  const rows = sectors.filter((s) => s.rs_20 != null && s.foreign_intensity_20 != null && s.n >= 2);
  const byRs = [...rows].sort((a, b) => (b.rs_20 ?? 0) - (a.rs_20 ?? 0));
  const byForeign = [...rows].sort((a, b) => (b.foreign_intensity_20 ?? 0) - (a.foreign_intensity_20 ?? 0));
  const dates = Array.from(new Set(sectorTs.map((d) => d.date))).sort();
  const subs = byRs.map((s) => s.sub_sector);
  const lookup = new Map(sectorTs.map((d) => [`${d.sub_sector}|${d.date}`, d.rs_20]));
  const values = subs.map((s) => dates.map((d) => lookup.get(`${s}|${d}`) ?? null));
  const avg = (s: Sector) => (horizon === 1 ? s.avg_conf_1 : s.avg_conf_20);

  const summary: { title: Bi; list: Sector[]; fmt: (s: Sector) => string; tone: string }[] = [
    { title: { id: "Paling kuat sebulan ini", en: "Strongest this month" }, list: byRs.slice(0, 3), fmt: (s) => `${signed((s.rs_20 ?? 0) * 100, 1, "%")} vs IHSG`, tone: "text-[#9cc5f5]" },
    { title: { id: "Paling lemah sebulan ini", en: "Weakest this month" }, list: byRs.slice(-3).reverse(), fmt: (s) => `${signed((s.rs_20 ?? 0) * 100, 1, "%")} vs IHSG`, tone: "text-[#f0a3a3]" },
    { title: { id: "Paling diburu asing", en: "Most foreign-bought" }, list: byForeign.slice(0, 3), fmt: (s) => idr(s.foreign_net_20, lang), tone: "text-arus" },
  ];

  return (
    <div className="pt-10 sm:pt-12">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="max-w-3xl">
        <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-balance sm:text-5xl">
          <T id="Sektor mana yang sedang kuat?" en="Which sectors are strong right now?" />
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
          <T
            id="Saham jarang melawan arus sektornya. Halaman ini menjawab dua pertanyaan untuk setiap kelompok industri: apakah harganya sedang naik lebih cepat dari IHSG, dan apakah investor asing sedang membeli."
            en="Stocks rarely swim against their sector. This page answers two questions for every industry group: is it rising faster than IHSG, and are foreign investors buying?"
          />
        </p>
      </motion.header>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {summary.map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.06, ease: EASE }} className="rounded-2xl bg-surface p-5 ring-1 ring-line">
            <h2 className={`text-[13px] font-semibold ${c.tone}`}>{tx(c.title)}</h2>
            <ol className="mt-3 space-y-2.5">
              {c.list.map((s, k) => (
                <li key={s.sub_sector} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-[15px] text-ink">
                    <span className="num mr-2 text-muted">{k + 1}</span>
                    {label(s.sub_sector)}
                  </span>
                  <span className="num shrink-0 text-[13px] text-ink-2">{c.fmt(s)}</span>
                </li>
              ))}
            </ol>
          </motion.div>
        ))}
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold tracking-tight">
          <T id="Empat kelompok sektor" en="Four sector groups" />
        </h2>
        <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-muted">
          <T
            id="Setiap kelompok industri masuk ke salah satu dari empat kotak di bawah, tergantung dua hal: apakah harganya naik lebih cepat dari IHSG sebulan terakhir, dan apakah investor asing sedang membeli."
            en="Every industry group falls into one of four boxes below, depending on two things: is its price rising faster than IHSG this month, and are foreign investors buying."
          />{" "}
          <Term k="foreignFlow">
            <T id="Tentang dana asing" en="About foreign flow" />
          </Term>
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {(
            [
              { key: "lead", t: { id: "Memimpin & dibeli asing", en: "Leading & foreign-bought" }, d: { id: "Angin sedang bertiup ke sini", en: "The wind is blowing here" }, f: (r: Sector) => (r.rs_20 ?? 0) > 0 && (r.foreign_intensity_20 ?? 0) > 0, tone: "text-arus" },
              { key: "quiet", t: { id: "Tertinggal tapi dikumpulkan asing", en: "Lagging but foreign-accumulated" }, d: { id: "Asing mulai masuk sebelum harga bergerak", en: "Foreigners moving in before price does" }, f: (r: Sector) => (r.rs_20 ?? 0) <= 0 && (r.foreign_intensity_20 ?? 0) > 0, tone: "text-[#9cc5f5]" },
              { key: "solo", t: { id: "Memimpin tanpa asing", en: "Leading without foreigners" }, d: { id: "Naik didorong investor lokal", en: "Rising on local money" }, f: (r: Sector) => (r.rs_20 ?? 0) > 0 && (r.foreign_intensity_20 ?? 0) <= 0, tone: "text-ink-2" },
              { key: "weak", t: { id: "Tertinggal & dijual asing", en: "Lagging & foreign-sold" }, d: { id: "Arus sedang menjauh", en: "The current is flowing away" }, f: (r: Sector) => (r.rs_20 ?? 0) <= 0 && (r.foreign_intensity_20 ?? 0) <= 0, tone: "text-[#f0a3a3]" },
            ] as const
          ).map((q) => {
            const list = byRs.filter(q.f);
            return (
              <div key={q.key} className="rounded-2xl bg-surface p-5 ring-1 ring-line">
                <div className={`text-[14px] font-semibold ${q.tone}`}>{tx(q.t)}</div>
                <div className="text-[12.5px] text-muted">{tx(q.d)}</div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {list.length === 0 && <span className="text-[13px] text-muted">–</span>}
                  {list.map((r) => (
                    <span key={r.sub_sector} className="rounded-full bg-raised px-2.5 py-1 text-[12.5px] text-ink ring-1 ring-line">
                      {label(r.sub_sector)}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-8 hidden lg:block">
          <SectorMap
            label={label}
            rows={rows.map((r) => ({
              key: r.sub_sector,
              x: r.rs_20 as number,
              y: r.foreign_intensity_20 as number,
              n: r.n,
              note: `${r.n} ${tx({ id: "saham", en: "stocks" })}${r.top_pick ? ` · ${tx({ id: "skor tertinggi", en: "top score" })}: ${r.top_pick}` : ""}`,
            }))}
          />
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold tracking-tight">
          <T id="Semua sektor" en="All sectors" />
        </h2>
        <div className="mt-5 hidden md:block">
          <table className="w-full border-separate border-spacing-0 text-[13.5px]">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-3 pr-4 font-normal"><T id="Kelompok industri" en="Industry group" /></th>
                <th className="py-3 pr-4 text-right font-normal"><T id="Jumlah saham" en="Stocks" /></th>
                <th className="py-3 pr-4 text-right font-normal"><T id="Naik vs IHSG (1 bln)" en="vs IHSG (1 mo)" /></th>
                <th className="py-3 pr-4 text-right font-normal"><T id="Naik vs IHSG (3 bln)" en="vs IHSG (3 mo)" /></th>
                <th className="py-3 pr-4 text-right font-normal"><T id="Dana asing (1 bln)" en="Foreign flow (1 mo)" /></th>
                <th className="py-3 pr-4 text-right font-normal"><T id="Rata-rata skor" en="Avg score" /></th>
                <th className="py-3 pr-2 font-normal"><T id="Skor tertinggi" en="Top score" /></th>
              </tr>
            </thead>
            <tbody>
              {byRs.map((s) => (
                <tr key={s.sub_sector} className="hover:bg-surface">
                  <td className="border-t border-line py-3 pr-4 text-ink">{label(s.sub_sector)}</td>
                  <td className="num border-t border-line py-3 pr-4 text-right text-ink-2">{s.n}</td>
                  <td className={`num border-t border-line py-3 pr-4 text-right ${(s.rs_20 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{signed((s.rs_20 ?? 0) * 100, 1, "%")}</td>
                  <td className={`num border-t border-line py-3 pr-4 text-right ${(s.rs_60 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{signed((s.rs_60 ?? 0) * 100, 1, "%")}</td>
                  <td className={`num border-t border-line py-3 pr-4 text-right ${(s.foreign_net_20 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{idr(s.foreign_net_20, lang)}</td>
                  <td className="num border-t border-line py-3 pr-4 text-right text-ink">{Math.round((avg(s) ?? 0.5) * 100)}</td>
                  <td className="border-t border-line py-3 pr-2">
                    {s.top_pick && (
                      <Link href={`/saham/${s.top_pick}/`} className="font-medium text-arus hover:underline">
                        {s.top_pick}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-4 divide-y divide-line md:hidden">
          {byRs.map((s) => (
            <li key={s.sub_sector} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium text-ink">{label(s.sub_sector)}</span>
                <span className={`num text-[13px] ${(s.rs_20 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{signed((s.rs_20 ?? 0) * 100, 1, "%")} vs IHSG</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 text-[12.5px] text-muted">
                <span>
                  {tx({ id: "Asing", en: "Foreign" })} <span className={`num ${(s.foreign_net_20 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{idr(s.foreign_net_20, lang)}</span>
                </span>
                <span>{s.n} {tx({ id: "saham", en: "stocks" })}</span>
                {s.top_pick && (
                  <Link href={`/saham/${s.top_pick}/`} className="text-arus">
                    {s.top_pick}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {dates.length > 0 && (
        <section className="mt-14">
          <button onClick={() => setHistory((h) => !h)} aria-expanded={history} className="flex w-full cursor-pointer items-center justify-between gap-3 border-y border-line py-4 text-left">
            <span>
              <span className="block text-[16px] font-semibold">
                <T id="Riwayat mingguan: sektor mana yang bergantian memimpin" en="Weekly history: which sectors took turns leading" />
              </span>
              <span className="text-[13px] text-muted">
                <T id="Biru = mengalahkan IHSG minggu itu, merah = tertinggal. Baca dari kiri ke kanan." en="Blue = beat IHSG that week, red = lagged. Read left to right." />
              </span>
            </span>
            <ChevronDown size={18} className={`shrink-0 text-muted transition-transform duration-200 ${history ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence initial={false}>
            {history && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
                <div className="overflow-x-auto pt-6">
                  <div className="min-w-[640px]">
                    <Heatmap rows={subs} cols={dates} values={values} label={label} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
}

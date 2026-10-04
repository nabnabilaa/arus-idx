"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Search } from "lucide-react";
import { useState } from "react";
import { Heatmap, SectorMap } from "@/components/charts/analytics";
import { Term } from "@/components/term";
import { SUBSECTOR_ID } from "@/lib/features";
import { idr, signed } from "@/lib/format";
import { T, useLang, type Bi } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import type { Bundle, FinGrade, Sector } from "@/lib/types";
import { FIN_GRADE } from "@/components/perspectives";
import { price } from "@/lib/format";

export type SectorStock = { symbol: string; name: string | null; sub_sector: string | null; price: number | null; ret_1: number | null; ret_20: number | null; ff_net_20: number | null; fin_grade: FinGrade | null };

const EASE = [0.23, 1, 0.32, 1] as const;

export function SectorsView({ sectors, sectorTs, stocks }: Pick<Bundle, "sectors" | "sectorTs"> & { stocks: SectorStock[] }) {
  const { tx, lang } = useLang();
  const { horizon } = usePrefs();
  const [history, setHistory] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
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
                    <button
                      key={r.sub_sector}
                      onClick={() => {
                        setQ("");
                        setOpen(r.sub_sector);
                        document.getElementById("semua-sektor")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className="cursor-pointer rounded-full bg-raised px-2.5 py-1 text-[12.5px] text-ink ring-1 ring-line hover:ring-arus/50"
                    >
                      {label(r.sub_sector)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-8 hidden text-[12.5px] text-muted lg:block">
          {tx({ id: "Klik gelembung untuk melihat sektor itu beserta sahamnya.", en: "Click a bubble to see that sector and its stocks." })}
        </p>
        <div className="mt-2 hidden lg:block">
          <SectorMap
            onSelect={(k) => {
              setQ("");
              setOpen(k);
              setTimeout(() => document.getElementById(`sec-${k}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
            }}
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

      <section id="semua-sektor" className="mt-14 scroll-mt-28">
        <h2 className="text-2xl font-semibold tracking-tight">
          <T id="Semua sektor" en="All sectors" />
        </h2>
        <label className="mt-4 flex h-10 max-w-md items-center gap-2 rounded-lg bg-surface px-3 ring-1 ring-line focus-within:ring-arus/60">
          <Search size={15} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx({ id: "Cari sektor atau kode saham (mis. bank, BBCA)", en: "Search a sector or stock (e.g. banks, BBCA)" })} className="w-full bg-transparent text-[13.5px] text-ink placeholder:text-muted focus:outline-none" />
        </label>
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
          {byRs
            .filter((sec) => {
              const t = q.trim().toLowerCase();
              if (!t) return true;
              if (label(sec.sub_sector).toLowerCase().includes(t) || sec.sub_sector.toLowerCase().includes(t)) return true;
              return stocks.some((x) => x.sub_sector === sec.sub_sector && (x.symbol.toLowerCase().includes(t) || (x.name ?? "").toLowerCase().includes(t)));
            })
            .map((sec) => {
              const isOpen = open === sec.sub_sector || (q.trim().length >= 3 && stocks.some((x) => x.sub_sector === sec.sub_sector && x.symbol.toLowerCase() === q.trim().toLowerCase()));
              const members = stocks.filter((x) => x.sub_sector === sec.sub_sector).sort((a, z) => (z.ret_20 ?? 0) - (a.ret_20 ?? 0));
              return (
                <li key={sec.sub_sector} id={`sec-${sec.sub_sector}`} className="scroll-mt-28">
                  <button onClick={() => setOpen(isOpen ? null : sec.sub_sector)} aria-expanded={isOpen} className="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-4 py-3 text-left hover:bg-raised/40 sm:grid-cols-[minmax(0,1fr)_90px_110px_130px_auto] sm:px-5">
                    <span className="min-w-0">
                      <span className="block truncate text-[14.5px] font-medium text-ink">{label(sec.sub_sector)}</span>
                      <span className="block text-[11.5px] text-muted">{sec.n} {tx({ id: "saham", en: "stocks" })}</span>
                    </span>
                    <span className={`num text-right text-[13px] ${(sec.rs_20 ?? 0) >= 0 ? "text-up" : "text-down"}`}>
                      {signed((sec.rs_20 ?? 0) * 100, 1, "%")}
                      <span className="block text-[10.5px] text-muted">{tx({ id: "vs IHSG 1 bln", en: "vs IHSG 1 mo" })}</span>
                    </span>
                    <span className={`num hidden text-right text-[13px] sm:block ${(sec.rs_60 ?? 0) >= 0 ? "text-up" : "text-down"}`}>
                      {signed((sec.rs_60 ?? 0) * 100, 1, "%")}
                      <span className="block text-[10.5px] text-muted">{tx({ id: "vs IHSG 3 bln", en: "vs IHSG 3 mo" })}</span>
                    </span>
                    <span className={`num hidden text-right text-[13px] sm:block ${(sec.foreign_net_20 ?? 0) >= 0 ? "text-up" : "text-down"}`}>
                      {idr(sec.foreign_net_20, lang)}
                      <span className="block text-[10.5px] text-muted">{tx({ id: "asing 1 bln", en: "foreign 1 mo" })}</span>
                    </span>
                    <ChevronDown size={16} className={`shrink-0 text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: EASE }} className="overflow-hidden">
                        <div className="overflow-x-auto px-4 pb-4 sm:px-5">
                          <table className="w-full min-w-[560px] border-separate border-spacing-0 text-[13px]">
                            <thead>
                              <tr className="text-right text-[11px] text-muted">
                                <th className="py-1.5 pr-3 text-left font-normal">{tx({ id: "Saham", en: "Stock" })}</th>
                                <th className="py-1.5 pr-3 font-normal">{tx({ id: "Harga", en: "Price" })}</th>
                                <th className="py-1.5 pr-3 font-normal">{tx({ id: "Hari ini", en: "Today" })}</th>
                                <th className="py-1.5 pr-3 font-normal">{tx({ id: "1 bulan", en: "1 month" })}</th>
                                <th className="py-1.5 pr-3 font-normal">{tx({ id: "Asing 1 bln", en: "Foreign 1 mo" })}</th>
                                <th className="py-1.5 font-normal">{tx({ id: "Keuangan", en: "Financials" })}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {members.map((x) => (
                                <tr key={x.symbol} className="num text-right">
                                  <td className="border-t border-line py-1.5 pr-3 text-left">
                                    <Link href={`/saham/${x.symbol}/`} className="font-semibold text-ink hover:text-arus">
                                      {x.symbol}
                                    </Link>
                                    <span className="ml-2 hidden text-[11.5px] text-muted lg:inline">{x.name}</span>
                                  </td>
                                  <td className="border-t border-line py-1.5 pr-3 text-ink-2">{price(x.price, lang)}</td>
                                  <td className={`border-t border-line py-1.5 pr-3 ${(x.ret_1 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{signed((x.ret_1 ?? 0) * 100, 1, "%")}</td>
                                  <td className={`border-t border-line py-1.5 pr-3 ${(x.ret_20 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{signed((x.ret_20 ?? 0) * 100, 1, "%")}</td>
                                  <td className={`border-t border-line py-1.5 pr-3 ${(x.ff_net_20 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{idr(x.ff_net_20, lang)}</td>
                                  <td className={`border-t border-line py-1.5 ${x.fin_grade ? FIN_GRADE[x.fin_grade].tone : "text-muted"}`}>{x.fin_grade ? tx(FIN_GRADE[x.fin_grade].label) : "–"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
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

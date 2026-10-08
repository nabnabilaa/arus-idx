"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, CalendarDays, Globe, LineChart, ScrollText, ShieldCheck, UserRoundSearch, Zap } from "lucide-react";
import { useLang, type Bi } from "@/lib/i18n";

export type ExploreStats = {
  unusual: number;
  chains: number;
  agendaWeek: number;
  ihsgWeek: number | null;
  foreignWeek: number | null;
  proofFolds: string;
  stocks: number;
};

const EASE = [0.23, 1, 0.32, 1] as const;

/** The map of Arus on the home page: each tool, the question it answers, and today's live number. */
export function Explore({ st }: { st: ExploreStats }) {
  const { tx, lang } = useLang();
  const p = (x: number | null) => (x == null ? "–" : `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1).replace(".", lang === "id" ? "," : ".")}%`);
  const t = (x: number | null) => (x == null ? "–" : `${x >= 0 ? "+" : "−"}${lang === "id" ? "Rp" : "IDR "}${Math.abs(x / 1e12).toFixed(1).replace(".", lang === "id" ? "," : ".")} T`);
  const items: { href: string; icon: React.ReactNode; q: Bi; t: Bi; stat: string; statNote: Bi }[] = [
    { href: "/saham/BBCA/", icon: <LineChart size={18} />, t: { id: "Halaman saham", en: "Stock page" }, q: { id: "Satu saham dari tiga sudut: besok, beberapa minggu, jangka panjang", en: "One stock from three angles: tomorrow, weeks, long term" }, stat: String(st.stocks), statNote: { id: "saham", en: "stocks" } },
    { href: "/asing/", icon: <Globe size={18} />, t: { id: "Asing & bandar", en: "Foreign & brokers" }, q: { id: "Siapa yang sebenarnya membeli, dan gayanya", en: "Who is really buying, and how" }, stat: t(st.foreignWeek), statNote: { id: "asing sepekan", en: "foreign, week" } },
    { href: "/orang-dalam/", icon: <UserRoundSearch size={18} />, t: { id: "Orang dalam", en: "Insiders" }, q: { id: "Direksi dan pemegang besar yang terus menambah atau melepas", en: "Directors and big holders who keep adding or selling" }, stat: String(st.chains), statNote: { id: "rantai transaksi", en: "filing chains" } },
    { href: "/anomali/", icon: <Zap size={18} />, t: { id: "Tak biasa", en: "Unusual" }, q: { id: "Saham yang keluar dari kebiasaannya hari ini", en: "Stocks breaking their habits today" }, stat: String(st.unusual), statNote: { id: "saham hari ini", en: "stocks today" } },
    { href: "/agenda/", icon: <CalendarDays size={18} />, t: { id: "Agenda", en: "Agenda" }, q: { id: "Dividen, RUPS, dan rights issue yang mendekat", en: "Dividends, AGMs and rights issues coming up" }, stat: String(st.agendaWeek), statNote: { id: "agenda 10 hari", en: "in 10 days" } },
    { href: "/rekap/", icon: <ScrollText size={18} />, t: { id: "Rekap pekan", en: "Week in review" }, q: { id: "Sepekan bursa dalam satu halaman", en: "The trading week on one page" }, stat: p(st.ihsgWeek), statNote: { id: "IHSG sepekan", en: "IHSG, week" } },
    { href: "/kejujuran/", icon: <ShieldCheck size={18} />, t: { id: "Bukti", en: "Proof" }, q: { id: "Rapor setiap model, termasuk yang tidak lolos", en: "A report card for every model, including the ones that failed" }, stat: st.proofFolds, statNote: { id: "periode di atas acak", en: "periods above random" } },
  ];
  return (
    <section className="mb-14">
      <h2 className="text-lg font-semibold tracking-tight">{tx({ id: "Jelajahi Arus", en: "Explore Arus" })}</h2>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it, i) => (
          <motion.div key={it.href} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 + i * 0.04, ease: EASE }} className={i === 0 ? "lg:row-span-2" : ""}>
            <Link
              href={it.href}
              className="group flex h-full flex-col rounded-2xl bg-surface p-4 ring-1 ring-line transition-[box-shadow,background-color] duration-200 hover:bg-raised/60 hover:ring-arus/40"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-arus/10 text-arus">{it.icon}</span>
                <ArrowUpRight size={16} className="text-muted transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-arus" />
              </div>
              <div className="mt-3 text-[15px] font-semibold text-ink">{tx(it.t)}</div>
              <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{tx(it.q)}</p>
              <div className="mt-auto flex items-baseline gap-1.5 pt-3">
                <span className={`num font-semibold text-ink ${i === 0 ? "text-3xl" : "text-lg"}`}>{it.stat}</span>
                <span className="text-[12px] text-muted">{tx(it.statNote)}</span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

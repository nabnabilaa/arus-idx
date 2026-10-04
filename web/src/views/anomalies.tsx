"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, ChevronDown, Globe, TrendingDown, TrendingUp, Waves } from "lucide-react";
import { useState } from "react";
import { Segmented } from "@/components/ui";
import { idr, price, signed } from "@/lib/format";
import { T, useLang, type Bi } from "@/lib/i18n";
import type { Bundle, Stock } from "@/lib/types";

const EASE = [0.23, 1, 0.32, 1] as const;

type Event = "foreign_up" | "foreign_down" | "volume_up" | "return_up" | "return_down";
type Level = 2 | 3;

const EVENT: Record<Event, { label: Bi; icon: React.ReactNode; z: (s: Stock) => number | null; sign: 1 | -1 }> = {
  foreign_up: { label: { id: "Asing borong besar", en: "Heavy foreign buying" }, icon: <Globe size={16} />, z: (s) => s.z_foreign, sign: 1 },
  foreign_down: { label: { id: "Asing jual besar", en: "Heavy foreign selling" }, icon: <Globe size={16} />, z: (s) => s.z_foreign, sign: -1 },
  volume_up: { label: { id: "Volume melonjak", en: "Volume spike" }, icon: <Waves size={16} />, z: (s) => s.z_volume, sign: 1 },
  return_up: { label: { id: "Harga naik tajam", en: "Sharp price rise" }, icon: <TrendingUp size={16} />, z: (s) => s.z_return, sign: 1 },
  return_down: { label: { id: "Harga turun tajam", en: "Sharp price drop" }, icon: <TrendingDown size={16} />, z: (s) => s.z_return, sign: -1 },
};
const ORDER: Event[] = ["foreign_up", "foreign_down", "volume_up", "return_up", "return_down"];

const hits = (s: Stock, e: Event, min: number) => ((EVENT[e].z(s) ?? 0) * EVENT[e].sign) >= min;

export function AnomaliesView({ ranking, history }: { ranking: Stock[]; history: Bundle["anomalyHistory"] }) {
  const { tx, lang } = useLang();
  const [focus, setFocus] = useState<Event | "all">("all");
  const [min, setMin] = useState<Level>(3);
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  const strength = (s: Stock) => Math.max(...ORDER.filter((e) => focus === "all" || e === focus).map((e) => (EVENT[e].z(s) ?? 0) * EVENT[e].sign));
  const rows = ranking.filter((s) => strength(s) >= min).sort((a, b) => strength(b) - strength(a));
  const countToday = (e: Event) => ranking.filter((s) => hits(s, e, min)).length;

  const detail = (s: Stock, e: Event): string => {
    if (e.startsWith("foreign"))
      return tx({
        id: `Asing ${s.ff_today != null && s.ff_today >= 0 ? "beli" : "jual"} bersih ${idr(Math.abs(s.ff_today ?? 0), "id")}, biasanya ±${idr(s.ff_typical, "id")} sehari`,
        en: `Foreigners net ${s.ff_today != null && s.ff_today >= 0 ? "bought" : "sold"} ${idr(Math.abs(s.ff_today ?? 0), "en")}, usually ±${idr(s.ff_typical, "en")} a day`,
      });
    if (e === "volume_up")
      return tx({ id: `Volume ${(s.vol_mult ?? 0).toFixed(1).replace(".", ",")}× dari biasanya`, en: `Volume ${(s.vol_mult ?? 0).toFixed(1)}× its usual` });
    return tx({
      id: `Harga ${signed((s.ret_1 ?? 0) * 100, 1, "%")}, biasanya ±${((s.ret_typical ?? 0) * 100).toFixed(1).replace(".", ",")}% sehari`,
      en: `Price ${signed((s.ret_1 ?? 0) * 100, 1, "%")}, usually ±${((s.ret_typical ?? 0) * 100).toFixed(1)}% a day`,
    });
  };

  return (
    <div className="pt-10 sm:pt-12">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="max-w-3xl">
        <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-balance sm:text-5xl">
          <T id="Saham yang hari ini keluar dari kebiasaannya" en="Stocks breaking their own habits today" />
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
          <T
            id="Gunanya: tahu lebih awal saham mana yang sedang kedatangan sesuatu, entah dana besar, berita, atau institusi yang masuk-keluar. Setiap saham dibandingkan dengan kebiasaannya sendiri 3 bulan terakhir, jadi volume dua kali lipat di bank besar terdeteksi, sementara di saham kecil yang memang liar tidak."
            en="Why it matters: spot early which stocks have something going on, whether big money, news, or institutions moving. Each stock is compared with its own last 3 months, so double volume at a big bank gets flagged while it wouldn't at an always-wild small cap."
          />
        </p>
      </motion.header>

      {/* what usually follows */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          <T id="Biasanya apa yang terjadi sesudahnya?" en="What usually follows?" />
        </h2>
        <p className="mt-1.5 max-w-[75ch] text-[13.5px] leading-relaxed text-muted">
          <T
            id="Dari semua kejadian serupa di histori Arus (Juli 2025 – Oktober 2026): seberapa sering saham itu mengalahkan saham rata-rata sesudahnya. 50 berarti tidak ada bedanya. Klik kartu untuk menyaring daftar di bawah."
            en="From every similar event in Arus' history (July 2025 – October 2026): how often the stock beat the median stock afterwards. 50 means no difference. Click a card to filter the list below."
          />
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {ORDER.map((e, i) => {
            const h = history?.[e];
            const b1 = h?.beat1 != null ? Math.round(h.beat1 * 100) : null;
            const b5 = h?.beat5 != null ? Math.round(h.beat5 * 100) : null;
            const tone = (b: number | null) => (b == null ? "text-muted" : b >= 53 ? "text-[#9cc5f5]" : b <= 47 ? "text-[#f0a3a3]" : "text-ink");
            const active = focus === e;
            return (
              <motion.button
                key={e}
                onClick={() => setFocus(active ? "all" : e)}
                aria-pressed={active}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.05, ease: EASE }}
                className={`flex cursor-pointer flex-col rounded-2xl p-4 text-left ring-1 transition-colors duration-150 ${active ? "bg-arus/10 ring-arus/50" : "bg-surface ring-line hover:ring-line-strong"}`}
              >
                <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                  <span className="text-arus">{EVENT[e].icon}</span>
                  {tx(EVENT[e].label)}
                </span>
                <span className="mt-3 grid grid-cols-2 gap-2">
                  <span>
                    <span className={`num block text-2xl font-semibold ${tone(b1)}`}>{b1 ?? "–"}</span>
                    <span className="block text-[11px] text-muted">{tx({ id: "dari 100, besok", en: "of 100, next day" })}</span>
                  </span>
                  <span>
                    <span className={`num block text-2xl font-semibold ${tone(b5)}`}>{b5 ?? "–"}</span>
                    <span className="block text-[11px] text-muted">{tx({ id: "dari 100, 5 hari", en: "of 100, 5 days" })}</span>
                  </span>
                </span>
                <span className="mt-3 flex items-center justify-between text-[11.5px] text-muted">
                  <span>{h ? tx({ id: `${h.n5.toLocaleString("id-ID")} kejadian`, en: `${h.n5.toLocaleString("en-US")} events` }) : ""}</span>
                  <span className="num text-ink-2">{tx({ id: `${countToday(e)} hari ini`, en: `${countToday(e)} today` })}</span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* today */}
      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {focus === "all" ? <T id="Hari ini" en="Today" /> : tx(EVENT[focus].label)} · <span className="num text-ink-2">{rows.length}</span> <T id="saham" en="stocks" />
            </h2>
          </div>
          <Segmented<Level>
            label={tx({ id: "Seberapa tidak biasa", en: "How unusual" })}
            value={min}
            onChange={setMin}
            options={[
              { value: 3, label: tx({ id: "Sangat tidak biasa", en: "Very unusual" }) },
              { value: 2, label: tx({ id: "Agak tidak biasa", en: "Somewhat unusual" }) },
            ]}
          />
        </div>
        <p className="mt-1.5 text-[12.5px] text-muted">
          {min === 3
            ? tx({ id: "Untuk saham itu sendiri, kejadian seperti ini hanya beberapa kali setahun.", en: "For that stock, an event like this happens only a few times a year." })
            : tx({ id: "Untuk saham itu sendiri, kejadian seperti ini kira-kira sekali sebulan.", en: "For that stock, an event like this happens about once a month." })}
        </p>

        <ul className="mt-5 grid items-start gap-2.5 lg:grid-cols-2">
          {rows.slice(0, all ? rows.length : 10).map((s) => {
            const events = ORDER.filter((e) => hits(s, e, 2));
            const up = (s.ret_1 ?? 0) >= 0;
            const isOpen = open === s.symbol;
            return (
              <li key={s.symbol} className="overflow-hidden rounded-xl bg-surface ring-1 ring-line">
                <button onClick={() => setOpen(isOpen ? null : s.symbol)} aria-expanded={isOpen} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-raised/40 sm:px-5">
                  <span className="w-14 shrink-0 text-[15px] font-semibold text-ink">{s.symbol}</span>
                  <span className={`num w-14 shrink-0 text-[12.5px] ${up ? "text-up" : "text-down"}`}>{signed((s.ret_1 ?? 0) * 100, 1, "%")}</span>
                  <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                    {events.map((e) => (
                      <span key={e} className={`rounded-full px-2 py-0.5 text-[11.5px] ring-1 ${EVENT[e].sign > 0 && e !== "return_up" ? "bg-up/10 text-[#9cc5f5] ring-up/30" : "bg-down/10 text-[#f0a3a3] ring-down/30"}`}>
                        {tx(EVENT[e].label)}
                      </span>
                    ))}
                  </span>
                  <ChevronDown size={16} className={`shrink-0 text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: EASE }} className="overflow-hidden">
                      <div className="px-4 pb-4 sm:px-5">
                        <div className="mb-2 text-[12.5px] text-muted">
                          {s.name} · {price(s.price, lang)}
                        </div>
                        <ul className="grid gap-2">
                          {events.map((e) => {
                            const h = history?.[e];
                            return (
                              <li key={e} className="rounded-lg bg-ground/60 px-3 py-2 ring-1 ring-line">
                                <div className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                                  <span className="text-arus">{EVENT[e].icon}</span>
                                  {tx(EVENT[e].label)}
                                </div>
                                <div className="mt-0.5 text-[12.5px] text-ink-2">{detail(s, e)}</div>
                                {h?.beat5 != null && (
                                  <div className="mt-0.5 text-[11.5px] text-muted">
                                    {tx({ id: `Sesudah kejadian seperti ini: unggul ${Math.round(h.beat5 * 100)} dari 100 kali dalam 5 hari`, en: `After events like this: won ${Math.round(h.beat5 * 100)} times in 100 over 5 days` })}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                        <Link href={`/saham/${s.symbol}/`} className="mt-3 inline-flex items-center gap-1 text-[13px] text-arus hover:underline">
                          {tx({ id: `Buka halaman ${s.symbol}`, en: `Open ${s.symbol}` })} <ArrowUpRight size={14} />
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
        {rows.length > 10 && (
          <button onClick={() => setAll((v) => !v)} className="mt-3 cursor-pointer text-[13px] text-arus hover:underline">
            {all ? tx({ id: "Tampilkan lebih sedikit", en: "Show fewer" }) : tx({ id: `Tampilkan semua (${rows.length})`, en: `Show all (${rows.length})` })}
          </button>
        )}
        {rows.length === 0 && (
          <p className="py-14 text-center text-[14px] text-muted">
            <T id="Hari ini tidak ada saham yang setidak biasa ini. Coba pilih “Agak tidak biasa”." en="No stock is this unusual today. Try “Somewhat unusual”." />
          </p>
        )}
      </section>

      <p className="mt-10 max-w-[75ch] text-[13px] leading-relaxed text-muted">
        <T
          id="Kejadian tidak biasa bukan sinyal beli atau jual. Ia penanda bahwa ada sesuatu yang sedang terjadi. Angka “sesudahnya” adalah rata-rata dari histori Arus yang pendek, bukan janji; cek beritanya sebelum mengambil kesimpulan."
          en="An unusual event is not a buy or sell signal; it marks that something is happening. The “what follows” figures are averages over Arus' short history, not promises. Check the news before concluding anything."
        />
      </p>
    </div>
  );
}

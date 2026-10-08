"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { dateLabel, pct, price, signed } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { AGENDA_LABEL } from "@/lib/agenda";
import type { AgendaBook, AgendaItem, DividendStudy } from "@/lib/types";

const EASE = [0.23, 1, 0.32, 1] as const;

/** Dividend per share: whole rupiah from Rp10 up, two decimals below (Rp0,27 is not Rp0). */
export const amount = (x: number | null | undefined, lang: "id" | "en") =>
  x == null ? "–" : x.toLocaleString(lang === "id" ? "id-ID" : "en-US", { maximumFractionDigits: x >= 10 ? 0 : 2 });

/** One line of detail per action, in the units a trader reads. */
export function useAgendaDetail() {
  const { tx, lang } = useLang();
  return (it: AgendaItem): string => {
    if (it.type === "dividend")
      return tx({
        id: `Rp${amount(it.amt, lang)}/saham${it.yield != null ? ` · yield ${pct(it.yield, 1)}` : ""}`,
        en: `IDR ${amount(it.amt, lang)}/share${it.yield != null ? ` · yield ${pct(it.yield, 1)}` : ""}`,
      });
    if (it.type === "agm") return it.time ? tx({ id: `Pukul ${it.time}`, en: `At ${it.time}` }) : "";
    if (it.type === "right_issue")
      return tx({
        id: `${it.old}:${it.new} @ Rp${price(it.price, lang)}${it.discount != null ? ` (${signed(it.discount * 100, 0, "%")} vs harga kini)` : ""}`,
        en: `${it.old}:${it.new} @ IDR ${price(it.price, lang)}${it.discount != null ? ` (${signed(it.discount * 100, 0, "%")} vs price)` : ""}`,
      });
    if (it.type === "stock_split") return tx({ id: `Rasio ${it.ratio}`, en: `Ratio ${it.ratio}` });
    if (it.type === "warrant") return tx({ id: `Harga laksana Rp${price(it.price, lang)}`, en: `Exercise IDR ${price(it.price, lang)}` });
    return "";
  };
}

function SymbolLink({ s, ranked }: { s: string; ranked: boolean }) {
  return ranked ? (
    <Link href={`/saham/${s}/`} className="font-semibold text-ink hover:text-arus">{s}</Link>
  ) : (
    <span className="font-semibold text-ink">{s}</span>
  );
}

/** "What's ahead": the next five trading days as columns. */
export function AgendaWeek({ items, ranked, asOf, link = true }: { items: AgendaItem[]; ranked: Set<string>; asOf: string; link?: boolean }) {
  const { tx, lang } = useLang();
  const detail = useAgendaDetail();
  const days: string[] = [];
  const d = new Date(asOf + "T00:00:00Z");
  while (days.length < 5) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) days.push(d.toISOString().slice(0, 10));
  }
  const byDay = (day: string) => items.filter((it) => it.date === day);
  return (
    <section className="mb-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <CalendarDays size={18} className="text-arus" />
          {tx({ id: "Agenda 5 hari bursa ke depan", en: "Next 5 trading days" })}
        </h2>
        {link && (
          <Link href="/agenda/" className="inline-flex items-center gap-1 text-[13px] text-arus hover:underline">
            {tx({ id: "Kalender lengkap", en: "Full calendar" })} <ArrowUpRight size={14} />
          </Link>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {days.map((day, i) => {
          const list = byDay(day);
          return (
            <motion.div
              key={day}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05, ease: EASE }}
              className="flex min-h-36 flex-col rounded-xl bg-surface ring-1 ring-line"
            >
              <div className="border-b border-line px-3 py-2 text-[12.5px] font-medium text-ink-2">
                {dateLabel(day, lang, { weekday: "short", year: undefined })}
              </div>
              <ul className="flex flex-1 flex-col gap-2.5 px-3 py-2.5">
                {list.slice(0, 5).map((it) => (
                  <li key={`${it.type}-${it.s}`} className="text-[12.5px] leading-snug">
                    <div className={`text-[11.5px] font-semibold uppercase tracking-wide ${AGENDA_LABEL[it.type].tone}`}>{tx(AGENDA_LABEL[it.type].label)}</div>
                    <SymbolLink s={it.s} ranked={ranked.has(it.s)} />
                    <div className="num text-[12px] text-muted">{detail(it)}</div>
                  </li>
                ))}
                {list.length > 5 && <li className="text-[12px] text-muted">{tx({ id: `+${list.length - 5} lainnya`, en: `+${list.length - 5} more` })}</li>}
                {list.length === 0 && <li className="text-[12px] text-muted">{tx({ id: "Tidak ada agenda", en: "Nothing scheduled" })}</li>}
              </ul>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

export function DividendStudyCards({ st }: { st: DividendStudy }) {
  const { tx } = useLang();
  const cards = [
    { v: pct(st.yield_med, 1), l: tx({ id: "Yield dividen median", en: "Median dividend yield" }), t: "text-ink" },
    { v: signed(st.move_med * 100, 1, "%"), l: tx({ id: "Gerak harga saat ex-date (median)", en: "Price move on the ex-date (median)" }), t: st.move_med < 0 ? "text-down" : "text-up" },
    { v: pct(st.drop_ratio_med, 0), l: tx({ id: "Bagian dividen yang 'dipotong' dari harga", en: "Share of the dividend taken off the price" }), t: "text-ink" },
    { v: pct(st.recovered_share, 0), l: tx({ id: `Pulih ke harga cum dalam ${st.within} hari bursa`, en: `Back to the cum price within ${st.within} sessions` }), t: "text-[#7fd4a8]" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c, i) => (
        <motion.div key={c.l} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.05, ease: EASE }} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
          <div className={`num text-2xl font-semibold ${c.t}`}>{c.v}</div>
          <div className="mt-1 text-[12px] leading-snug text-muted">{c.l}</div>
        </motion.div>
      ))}
    </div>
  );
}

/** Stock page: what's scheduled for this stock and how its past ex-dates went. */
export function StockAgenda({ items, history }: { items: AgendaItem[]; history: AgendaBook["history"][string] }) {
  const { tx, lang } = useLang();
  const detail = useAgendaDetail();
  if (!items.length && !history.length) return null;
  return (
    <section>
      <h3 className="flex items-center gap-2 text-[15px] font-semibold">
        <CalendarDays size={17} className="text-arus" />
        {tx({ id: "Agenda saham ini", en: "This stock's agenda" })}
      </h3>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((it) => (
          <li key={`${it.type}-${it.date}`} className="rounded-xl bg-surface p-3.5 ring-1 ring-line">
            <div className="flex items-baseline justify-between gap-2">
              <span className={`text-[12px] font-semibold uppercase tracking-wide ${AGENDA_LABEL[it.type].tone}`}>{tx(AGENDA_LABEL[it.type].label)}</span>
              <span className="num text-[12.5px] text-ink-2">{dateLabel(it.date, lang)}</span>
            </div>
            <div className="num mt-1 text-[13.5px] text-ink">{detail(it)}</div>
            {it.type === "dividend" && it.cum && (
              <div className="mt-0.5 text-[12px] text-muted">
                {tx({ id: `Beli paling lambat ${dateLabel(it.cum, "id")} untuk berhak. Dibayar ${it.pay ? dateLabel(it.pay, "id") : "–"}.`, en: `Buy by ${dateLabel(it.cum, "en")} to qualify. Paid ${it.pay ? dateLabel(it.pay, "en") : "–"}.` })}
              </div>
            )}
            {it.type === "right_issue" && it.dilution != null && (
              <div className="mt-0.5 text-[12px] text-muted">
                {tx({ id: `Kalau tidak ikut menebus, porsi kepemilikanmu turun hingga ${pct(it.dilution, 0)}.`, en: `Skip the rights and your stake shrinks by up to ${pct(it.dilution, 0)}.` })}
              </div>
            )}
            {it.type === "agm" && it.place && <div className="mt-0.5 truncate text-[12px] text-muted">{it.place}</div>}
          </li>
        ))}
      </ul>
      {history.length > 0 && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-2">
          {history.map((h) =>
            tx({
              id: `Ex-dividen ${dateLabel(h.ex, "id")}: dividen ${pct(h.yield, 1)}, harga ${signed(h.move * 100, 1, "%")} hari itu, ${h.recovered == null ? "belum kembali ke harga cum" : h.recovered === 0 ? "langsung bertahan di harga cum" : `kembali ke harga cum dalam ${h.recovered} hari`}.`,
              en: `Ex-dividend ${dateLabel(h.ex, "en")}: dividend ${pct(h.yield, 1)}, price ${signed(h.move * 100, 1, "%")} that day, ${h.recovered == null ? "not yet back to the cum price" : h.recovered === 0 ? "held the cum price" : `back to the cum price in ${h.recovered} days`}.`,
            }),
          ).join(" ")}
        </p>
      )}
    </section>
  );
}

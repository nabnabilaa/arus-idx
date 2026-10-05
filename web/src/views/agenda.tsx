"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { AgendaWeek, DividendStudyCards, useAgendaDetail } from "@/components/agenda";
import { Segmented } from "@/components/ui";
import { AGENDA_LABEL } from "@/lib/agenda";
import { dateLabel, pct } from "@/lib/format";
import { T, useLang } from "@/lib/i18n";
import type { AgendaBook, AgendaType, DividendStudy } from "@/lib/types";

const EASE = [0.23, 1, 0.32, 1] as const;
type Filter = "all" | AgendaType;

export function AgendaView({ book, ranked }: { book: AgendaBook; ranked: string[] }) {
  const { tx, lang } = useLang();
  const detail = useAgendaDetail();
  const isRanked = useMemo(() => new Set(ranked), [ranked]);
  const [filter, setFilter] = useState<Filter>("all");
  const st = "n" in book.study ? (book.study as DividendStudy) : null;
  const count = (t: AgendaType) => book.upcoming.filter((it) => it.type === t).length;
  const rows = book.upcoming.filter((it) => filter === "all" || it.type === filter);
  const dates = [...new Set(rows.map((it) => it.date))];

  return (
    <div className="pt-10 sm:pt-12">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="max-w-3xl">
        <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-balance sm:text-5xl">
          <T id="Agenda saham: dividen, RUPS, rights issue" en="Stock agenda: dividends, AGMs, rights issues" />
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
          <T
            id="Tanggal yang menggerakkan harga, dalam satu kalender: kapan terakhir beli untuk dapat dividen, berapa yield-nya dari harga sekarang, kapan RUPS, dan seberapa besar rights issue akan mengencerkan kepemilikanmu."
            en="The dates that move prices, in one calendar: the last day to buy for a dividend, its yield at today's price, when the AGM is, and how much a rights issue would dilute your stake."
          />
        </p>
      </motion.header>

      <div className="mt-10">
        <AgendaWeek items={book.upcoming} ranked={isRanked} asOf={book.as_of} link={false} />
      </div>

      {st && (
        <section className="mb-14">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            <T id="Apa yang biasanya terjadi saat ex-dividen?" en="What usually happens on the ex-dividend date?" />
          </h2>
          <p className="mt-1.5 max-w-[75ch] text-[13.5px] leading-relaxed text-muted">
            {tx({
              id: `Dari ${st.n} dividen di BEI dalam 90 hari terakhir. Di hari ex-dividen, harga dibuka tanpa hak dividen, jadi wajar turun. Pertanyaannya: turun berapa, dan berapa lama sampai kembali?`,
              en: `From ${st.n} IDX dividends over the last 90 days. On the ex-date the price opens without the dividend, so a drop is expected. The question is how much, and how long until it comes back.`,
            })}
          </p>
          <div className="mt-5">
            <DividendStudyCards st={st} />
          </div>
          <p className="mt-3 max-w-[75ch] text-[13px] leading-relaxed text-ink-2">
            {tx({
              id: `Artinya: membeli tepat sebelum cum date demi dividen biasanya impas, karena harga turun hampir sebesar dividennya (${pct(st.drop_ratio_med, 0)}). Sekitar ${pct(st.recovered_share, 0)} saham kembali ke harga cum dalam ${st.within} hari bursa; sisanya belum.`,
              en: `In other words, buying just before the cum date for the dividend tends to break even: the price drops by most of the dividend (${pct(st.drop_ratio_med, 0)}). About ${pct(st.recovered_share, 0)} of stocks got back to the cum price within ${st.within} sessions; the rest did not.`,
            })}
          </p>
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            <T id="Kalender lengkap" en="Full calendar" /> · <span className="num text-ink-2">{rows.length}</span>
          </h2>
          <Segmented<Filter>
            label={tx({ id: "Jenis agenda", en: "Action type" })}
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: tx({ id: "Semua", en: "All" }) },
              ...(["dividend", "agm", "right_issue", "stock_split", "warrant"] as AgendaType[])
                .filter((t) => count(t) > 0)
                .map((t) => ({ value: t as Filter, label: `${tx(AGENDA_LABEL[t].label)} (${count(t)})` })),
            ]}
          />
        </div>
        <div className="mt-5 space-y-5">
          {dates.map((d) => (
            <div key={d} className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
              <div className="num pt-2 text-[13px] font-medium text-ink-2">{dateLabel(d, lang, { weekday: "short" })}</div>
              <ul className="grid gap-2 md:grid-cols-2">
                {rows
                  .filter((it) => it.date === d)
                  .map((it) => (
                    <li key={`${it.type}-${it.s}`} className="rounded-xl bg-surface px-4 py-3 ring-1 ring-line">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="flex items-baseline gap-2">
                          {isRanked.has(it.s) ? (
                            <Link href={`/saham/${it.s}/`} className="text-[14px] font-semibold text-ink hover:text-arus">{it.s}</Link>
                          ) : (
                            <span className="text-[14px] font-semibold text-ink">{it.s}</span>
                          )}
                          <span className={`text-[11px] font-semibold uppercase tracking-wide ${AGENDA_LABEL[it.type].tone}`}>{tx(AGENDA_LABEL[it.type].label)}</span>
                        </span>
                        <span className="num text-[12.5px] text-ink-2">{detail(it)}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-muted">
                        {(it.name ?? "").replace(/^PT\.? /, "").replace(/ Tbk\.?$/, "")}
                        {it.type === "dividend" && it.cum ? tx({ id: ` · beli s.d. ${dateLabel(it.cum, "id", { year: undefined })}`, en: ` · buy by ${dateLabel(it.cum, "en", { year: undefined })}` }) : ""}
                        {it.type === "right_issue" && it.dilution != null ? tx({ id: ` · pengenceran s.d. ${pct(it.dilution, 0)}`, en: ` · dilution up to ${pct(it.dilution, 0)}` }) : ""}
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-10 max-w-[75ch] text-[13px] leading-relaxed text-muted">
        <T
          id="Kalender aksi korporasi dari Sectors. Yield dihitung dari harga penutupan terakhir. Jadwal bisa berubah; cek keterbukaan informasi emiten sebelum bertransaksi. Informasi, bukan nasihat keuangan."
          en="Corporate-action calendar from Sectors. Yield uses the latest close. Schedules can change; check the company's disclosure before trading. Information, not financial advice."
        />
      </p>
    </div>
  );
}

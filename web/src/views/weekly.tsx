"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, ShieldAlert, ThumbsUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Tabs } from "@/components/tabs";
import { useAgendaDetail } from "@/components/agenda";
import { ShareCard } from "@/components/share";
import { WeekLookup } from "@/components/week-lookup";
import { WEEKLY_CARD } from "@/lib/cards";
import { C } from "@/components/charts/kit";
import { AGENDA_LABEL } from "@/lib/agenda";
import { dateLabel, idr, price, signed } from "@/lib/format";
import { T, useLang } from "@/lib/i18n";
import { IDX_SECTOR_EN } from "@/lib/weekly";
import type { WeeklyRecap } from "@/lib/types";

const EASE = [0.23, 1, 0.32, 1] as const;

/** Five daily bars, centred on zero. */
function DayBars({ days, fmt }: { days: { d: string; v: number }[]; fmt: (v: number) => string }) {
  const { lang } = useLang();
  const max = Math.max(...days.map((x) => Math.abs(x.v)), 1e-9);
  return (
    <div className="grid grid-cols-5 gap-2">
      {days.map((x, i) => {
        const h = (Math.abs(x.v) / max) * 44;
        return (
          <div key={x.d} className="flex flex-col items-center">
            <div className="relative h-24 w-full">
              <div className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
              <motion.div
                initial={{ height: 0 }}
                whileInView={{ height: h }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.06, ease: EASE }}
                className="absolute left-1/2 w-6 -translate-x-1/2 rounded-sm"
                style={{ background: x.v >= 0 ? C.up : C.down, ...(x.v >= 0 ? { bottom: "50%" } : { top: "50%" }) }}
              />
            </div>
            <div className={`num text-[11.5px] ${x.v >= 0 ? "text-up" : "text-down"}`}>{fmt(x.v)}</div>
            <div className="text-[11px] text-muted">{dateLabel(x.d, lang, { weekday: "short", day: undefined, month: undefined, year: undefined })}</div>
          </div>
        );
      })}
    </div>
  );
}

function StockLine({ s, name, right, sub, ranked }: { s: string; name?: string | null; right: React.ReactNode; sub?: React.ReactNode; ranked: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 border-t border-line py-2 first:border-t-0">
      <div className="min-w-0">
        {ranked ? (
          <Link href={`/saham/${s}/`} className="text-[13.5px] font-semibold text-ink hover:text-arus">{s}</Link>
        ) : (
          <span className="text-[13.5px] font-semibold text-ink">{s}</span>
        )}
        {name && <span className="ml-2 truncate text-[12px] text-muted">{name.replace(/^PT\.? /, "").replace(/ Tbk\.?$/, "")}</span>}
      </div>
      <div className="shrink-0 text-right">
        <div className="num text-[13.5px]">{right}</div>
        {sub && <div className="num text-[11px] text-muted">{sub}</div>}
      </div>
    </li>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5">
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {note && <p className="mt-0.5 text-[12px] text-muted">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

type Tab = "movers" | "foreign" | "sectors" | "volume" | "insiders";

export function WeeklyView({ w, ranked }: { w: WeeklyRecap; ranked: string[] }) {
  const { tx, lang } = useLang();
  const detail = useAgendaDetail();
  const isRanked = useMemo(() => new Set(ranked), [ranked]);
  const [tab, setTab] = useState<Tab>("movers");
  const st = w.stats;
  const sec = (x: string) => (lang === "id" ? x : IDX_SECTOR_EN[x] ?? x);
  const pctS = (x: number | null | undefined, d = 1) => signed(x == null ? null : x * 100, d, "%");
  const maxSec = Math.max(...w.sectors.map((x) => Math.abs(x.ret)), 1e-9);
  const short = (n: string | null | undefined) => (n ?? "").replace(/^PT\.? /, "").replace(/ Tbk\.?$/, "");

  // the week in one line: the mood, then the two numbers that set it
  const red = (st.ihsg ?? 0) < 0;
  const mood = red
    ? (st.ihsg ?? 0) <= -0.02 || st.down > st.up * 2
      ? tx({ id: "Pekan merah", en: "A red week" })
      : tx({ id: "Pekan melemah", en: "A soft week" })
    : (st.ihsg ?? 0) >= 0.02
      ? tx({ id: "Pekan hijau", en: "A green week" })
      : tx({ id: "Pekan menguat tipis", en: "A modestly firm week" });
  const fT = (x: number) => `${lang === "id" ? "Rp" : "IDR "}${Math.abs(x / 1e12).toFixed(1).replace(".", lang === "id" ? "," : ".")} T`;
  const headline = tx({
    id: `${mood}: IHSG ${pctS(st.ihsg)}, asing ${st.foreign >= 0 ? "masuk" : "keluar"} ${fT(st.foreign)}`,
    en: `${mood}: IHSG ${pctS(st.ihsg)}, foreigners ${st.foreign >= 0 ? "in" : "out"} ${fT(st.foreign)}`,
  });
  const subline = tx({
    id: `${st.down} saham turun, ${st.up} naik. Dari ${st.big_n} saham paling likuid, ${st.big_up} yang naik.`,
    en: `${st.down} stocks fell, ${st.up} rose. Of the ${st.big_n} most liquid, ${st.big_up} rose.`,
  });

  const top = w.gainers[0];
  const outflow = w.foreign.sell[0];
  const spike = w.spikes[0];
  const stories = [
    top && { tag: tx({ id: "Juara pekan ini", en: "Top of the week" }), s: top.s, name: top.name, big: pctS(top.ret), tone: "text-up", note: tx({ id: `Ditutup ${price(top.close, lang)} · hanya saham likuid`, en: `Closed ${price(top.close, lang)} · liquid stocks only` }) },
    outflow && { tag: tx({ id: "Paling dilepas asing", en: "Most sold by foreigners" }), s: outflow.s, name: outflow.name, big: idr(outflow.net, lang), tone: "text-down", note: tx({ id: `Harga sepekan ${pctS(outflow.ret)}`, en: `Price on the week ${pctS(outflow.ret)}` }) },
    spike && {
      tag: tx({ id: "Volume paling melonjak", en: "Biggest volume spike" }),
      s: spike.s,
      name: spike.name,
      big: `${spike.mult.toLocaleString(lang === "id" ? "id-ID" : "en-US", { maximumFractionDigits: 0 })}×`,
      tone: "text-arus",
      note: tx({ id: `dari biasanya, ${dateLabel(spike.day, "id", { year: undefined })} · harga ${pctS(spike.ret)}`, en: `its usual, ${dateLabel(spike.day, "en", { year: undefined })} · price ${pctS(spike.ret)}` }),
    },
  ].filter(Boolean) as { tag: string; s: string; name: string | null; big: string; tone: string; note: string }[];

  const tabs: { value: Tab; label: string }[] = [
    { value: "movers", label: tx({ id: "Penggerak", en: "Movers" }) },
    { value: "foreign", label: tx({ id: "Asing", en: "Foreign" }) },
    { value: "sectors", label: tx({ id: "Sektor", en: "Sectors" }) },
    { value: "volume", label: tx({ id: "Volume", en: "Volume" }) },
    { value: "insiders", label: tx({ id: "Orang dalam", en: "Insiders" }) },
  ];

  return (
    <div className="pt-7 sm:pt-9">
      {/* 1 · the week in one line */}
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px] font-medium text-arus">
              <T id="Rekap pekan" en="Week in review" /> · <span className="num">{dateLabel(w.from, lang, { year: undefined })} – {dateLabel(w.to, lang)}</span>
            </span>
            <ShareCard file={WEEKLY_CARD} />
          </div>
          <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-balance sm:text-[2.4rem]">{headline}</h1>
          <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">{subline}</p>
        </div>
        <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
          <div className="mb-2 flex justify-between text-[12px] text-muted">
            <span>{tx({ id: "IHSG per hari", en: "IHSG by day" })}</span>
            <span className="num">{w.ihsg_days.length ? price(w.ihsg_days[w.ihsg_days.length - 1].v, lang) : ""}</span>
          </div>
          <DayBars days={w.ihsg_days.map((x) => ({ d: x.d, v: x.chg }))} fmt={(v) => pctS(v)} />
        </div>
      </motion.header>

      {/* 2 · three stories */}
      <section className="mt-8 grid gap-3 md:grid-cols-3">
        {stories.map((x, i) => (
          <motion.div key={x.tag} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 + i * 0.07, ease: EASE }}>
            <div className="flex h-full flex-col rounded-2xl bg-surface p-5 ring-1 ring-line">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">{x.tag}</span>
              <div className="mt-3 flex items-baseline justify-between gap-3">
                {isRanked.has(x.s) ? (
                  <Link href={`/saham/${x.s}/`} className="text-2xl font-semibold tracking-tight text-ink hover:text-arus">{x.s}</Link>
                ) : (
                  <span className="text-2xl font-semibold tracking-tight text-ink">{x.s}</span>
                )}
                <span className={`num text-2xl font-semibold ${x.tone}`}>{x.big}</span>
              </div>
              <span className="truncate text-[12.5px] text-muted">{short(x.name)}</span>
              <span className="mt-auto pt-3 text-[12.5px] text-ink-2">{x.note}</span>
            </div>
          </motion.div>
        ))}
      </section>

      {/* 3 · the read, light */}
      <section className={`mt-8 grid gap-x-10 gap-y-5 ${w.reads.pos.length && w.reads.neg.length ? "md:grid-cols-2" : ""}`}>
        <div className={w.reads.pos.length ? "" : "hidden"}>
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[#7fd4a8]">
            <ThumbsUp size={15} /> <T id="Yang mendukung" en="What supports" />
          </h2>
          <ul className="mt-2 space-y-1.5 text-[14px] leading-relaxed text-ink-2">
            {w.reads.pos.map((r, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7fd4a8]" />
                {tx(r)}
              </li>
            ))}
            {w.reads.pos.length === 0 && <li className="text-muted">{tx({ id: "Tidak ada sisi positif yang menonjol dari data pekan ini.", en: "No clear positive in this week’s data." })}</li>}
          </ul>
        </div>
        <div>
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[#f0a3a3]">
            <ShieldAlert size={15} /> <T id="Yang perlu diwaspadai" en="What to be careful about" />
          </h2>
          <ul className={`mt-2 gap-x-10 space-y-1.5 text-[14px] leading-relaxed text-ink-2 ${w.reads.pos.length ? "" : "md:columns-2"}`}>
            {w.reads.neg.map((r, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#f0a3a3]" />
                {tx(r)}
              </li>
            ))}
            {w.reads.neg.length === 0 && <li className="text-muted">{tx({ id: "Tidak ada sisi waspada yang menonjol dari data pekan ini.", en: "No clear warning in this week’s data." })}</li>}
          </ul>
        </div>
      </section>

      {/* 4 · your stock */}
      <WeekLookup w={w} ranked={isRanked} />

      {/* 5 · the detail, one subject at a time */}
      <section className="mt-10">
        <Tabs label={tx({ id: "Rincian pekan", en: "Week detail" })} value={tab} onChange={setTab} items={tabs} />
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ duration: 0.22, ease: EASE }} className="pt-5">
            {tab === "movers" && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <Panel title={tx({ id: "Naik paling tinggi", en: "Top gainers" })}>
                    <ul>{w.gainers.map((m) => <StockLine key={m.s} s={m.s} name={m.name} ranked={isRanked.has(m.s)} right={<span className="text-up">{pctS(m.ret)}</span>} sub={price(m.close, lang)} />)}</ul>
                  </Panel>
                  <Panel title={tx({ id: "Turun paling dalam", en: "Top losers" })}>
                    <ul>{w.losers.map((m) => <StockLine key={m.s} s={m.s} name={m.name} ranked={isRanked.has(m.s)} right={<span className="text-down">{pctS(m.ret)}</span>} sub={price(m.close, lang)} />)}</ul>
                  </Panel>
                </div>
                {w.raw_top[0] && w.raw_top[0].s !== w.gainers[0]?.s && (
                  <p className="mt-3 text-[12px] text-muted">
                    {tx({
                      id: `Hanya saham dengan transaksi ≥ Rp1 miliar/hari. Tanpa saringan ini, juaranya ${w.raw_top[0].s} (${pctS(w.raw_top[0].ret, 0)}) dengan transaksi sepekan hanya ${idr(w.raw_top[0].val, "id")}.`,
                      en: `Only stocks trading ≥ IDR 1B a day. Unfiltered, the top name was ${w.raw_top[0].s} (${pctS(w.raw_top[0].ret, 0)}) on just ${idr(w.raw_top[0].val, "en")} all week.`,
                    })}
                  </p>
                )}
              </>
            )}
            {tab === "foreign" && (
              <div className="grid gap-4 lg:grid-cols-3">
                <Panel title={tx({ id: "Dana asing per hari", en: "Foreign flow by day" })}>
                  <DayBars days={w.foreign.days.map((x) => ({ d: x.d, v: x.net }))} fmt={(v) => idr(v, lang)} />
                </Panel>
                <Panel title={tx({ id: "Paling diborong", en: "Most bought" })}>
                  <ul>{w.foreign.buy.map((m) => <StockLine key={m.s} s={m.s} name={m.name} ranked={isRanked.has(m.s)} right={<span className="text-up">{idr(m.net, lang)}</span>} sub={pctS(m.ret)} />)}</ul>
                </Panel>
                <Panel title={tx({ id: "Paling dilepas", en: "Most sold" })}>
                  <ul>{w.foreign.sell.map((m) => <StockLine key={m.s} s={m.s} name={m.name} ranked={isRanked.has(m.s)} right={<span className="text-down">{idr(m.net, lang)}</span>} sub={pctS(m.ret)} />)}</ul>
                </Panel>
              </div>
            )}
            {tab === "sectors" && (
              <Panel title={tx({ id: "Median perubahan harga per sektor", en: "Median price change by sector" })}>
                <ul className="grid gap-x-10 gap-y-2 md:grid-cols-2">
                  {w.sectors.map((x, i) => (
                    <li key={x.sector} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_3.5rem] items-center gap-3 text-[12.5px]">
                      <span className="truncate text-ink-2">{sec(x.sector)}</span>
                      <span className="relative h-2.5">
                        <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
                        <motion.span
                          initial={{ width: 0 }}
                          animate={{ width: `${(Math.abs(x.ret) / maxSec) * 50}%` }}
                          transition={{ duration: 0.5, delay: i * 0.03, ease: EASE }}
                          className="absolute inset-y-0 rounded-sm"
                          style={{ background: x.ret >= 0 ? C.up : C.down, ...(x.ret >= 0 ? { left: "50%" } : { right: "50%" }) }}
                        />
                      </span>
                      <span className={`num text-right ${x.ret >= 0 ? "text-up" : "text-down"}`}>{pctS(x.ret)}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
            {tab === "volume" && (
              <Panel title={tx({ id: "Hari tersibuk pekan ini dibanding transaksi biasanya", en: "The week’s busiest day against the usual" })}>
                <ul className="grid gap-x-10 md:grid-cols-2">
                  {w.spikes.map((m) => (
                    <StockLine
                      key={m.s}
                      s={m.s}
                      name={m.name}
                      ranked={isRanked.has(m.s)}
                      right={<span className="text-arus">{`${m.mult.toLocaleString(lang === "id" ? "id-ID" : "en-US", { maximumFractionDigits: 0 })}×`}</span>}
                      sub={`${dateLabel(m.day, lang, { year: undefined })} · ${pctS(m.ret)}`}
                    />
                  ))}
                </ul>
              </Panel>
            )}
            {tab === "insiders" && (
              <Panel
                title={tx({ id: `${w.insiders.n} laporan transaksi pasar · beli ${idr(w.insiders.buy, "id")} · jual ${idr(w.insiders.sell, "id")}`, en: `${w.insiders.n} market-trade filings · bought ${idr(w.insiders.buy, "en")} · sold ${idr(w.insiders.sell, "en")}` })}
              >
                <ul className="grid gap-x-10 md:grid-cols-2">
                  {w.insiders.top.map((e, i) => (
                    <StockLine
                      key={`${e.s}-${i}`}
                      s={e.s}
                      name={e.holder}
                      ranked={isRanked.has(e.s)}
                      right={<span className={e.side === "buy" ? "text-[#7fd4a8]" : "text-[#f0a3a3]"}>{`${e.side === "buy" ? tx({ id: "Beli", en: "Buy" }) : tx({ id: "Jual", en: "Sell" })} ${idr(e.val, lang)}`}</span>}
                      sub={`@ ${price(e.px, lang)}`}
                    />
                  ))}
                </ul>
                <Link href="/orang-dalam/" className="mt-3 inline-flex items-center gap-1 text-[13px] text-arus hover:underline">
                  {tx({ id: "Semua laporan orang dalam", en: "All insider filings" })} <ArrowUpRight size={14} />
                </Link>
              </Panel>
            )}
          </motion.div>
        </AnimatePresence>
      </section>

      {/* 6 · next week */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">{tx({ id: "Pekan depan", en: "Next week" })}</h2>
          <Link href="/agenda/" className="inline-flex items-center gap-1 text-[13px] text-arus hover:underline">
            {tx({ id: "Kalender lengkap", en: "Full calendar" })} <ArrowUpRight size={14} />
          </Link>
        </div>
        <ul className="mt-3 grid gap-x-10 rounded-2xl bg-surface px-5 py-2 ring-1 ring-line md:grid-cols-2">
          {w.ahead.slice(0, 8).map((it) => (
            <StockLine key={`${it.type}-${it.s}`} s={it.s} ranked={isRanked.has(it.s)} name={tx(AGENDA_LABEL[it.type].label)} right={<span className="text-ink-2">{dateLabel(it.date, lang, { year: undefined })}</span>} sub={detail(it)} />
          ))}
        </ul>
        {w.cooling.length > 0 && (
          <p className="mt-3 text-[13px] text-ink-2">
            {tx({ id: "Dihentikan sementara (cooling down) pekan ini: ", en: "Halted for cooling-down this week: " })}
            <span className="font-medium text-warn">{w.cooling.join(", ")}</span>
          </p>
        )}
      </section>

      <p className="mt-10 max-w-[75ch] text-[12.5px] leading-relaxed text-muted">
        <T
          id="Harga, volume, dan dana asing dari ringkasan resmi BEI (dana asing dinilai pada harga rata-rata harian); orang dalam dan agenda dari Sectors. Kalimat “mendukung” dan “waspada” disusun otomatis dari angka di halaman ini, bukan ramalan. Informasi, bukan nasihat keuangan."
          en="Prices, volume and foreign flow from the official IDX summary (foreign flow valued at the daily average price); insiders and agenda from Sectors. The “supports” and “careful” lines are built automatically from the numbers on this page, not forecasts. Information, not financial advice."
        />
      </p>
    </div>
  );
}

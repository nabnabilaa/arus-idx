"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, ShieldAlert, ThumbsUp } from "lucide-react";
import { useMemo } from "react";
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

function Kpi({ label, value, note, tone, i }: { label: string; value: string; note?: string; tone: string; i: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.05, ease: EASE }} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
      <div className="text-[12px] text-muted">{label}</div>
      <div className={`num mt-1 text-2xl font-semibold ${tone}`}>{value}</div>
      {note && <div className="num mt-0.5 text-[11.5px] text-muted">{note}</div>}
    </motion.div>
  );
}

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

export function WeeklyView({ w, ranked }: { w: WeeklyRecap; ranked: string[] }) {
  const { tx, lang } = useLang();
  const detail = useAgendaDetail();
  const isRanked = useMemo(() => new Set(ranked), [ranked]);
  const st = w.stats;
  const sec = (x: string) => (lang === "id" ? x : IDX_SECTOR_EN[x] ?? x);
  const pctS = (x: number | null | undefined, d = 1) => signed(x == null ? null : x * 100, d, "%");
  const breadth = st.up / Math.max(1, st.up + st.down);
  const maxSec = Math.max(...w.sectors.map((x) => Math.abs(x.ret)), 1e-9);

  return (
    <div className="pt-10 sm:pt-12">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <p className="num text-[13px] font-medium text-arus">
            {dateLabel(w.from, lang, { year: undefined })} – {dateLabel(w.to, lang)}
          </p>
          <ShareCard file={WEEKLY_CARD} />
        </div>
        <h1 className="mt-2 text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-balance sm:text-5xl">
          <T id="Rekap pekan ini" en="This week in review" />
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
          <T
            id="Sepekan bursa dalam satu halaman, dihitung otomatis dari data resmi BEI dan Sectors: arah pasar, siapa yang bergerak, ke mana dana asing mengalir, apa yang dilakukan orang dalam, dan agenda pekan depan."
            en="A week of trading on one page, computed from official IDX and Sectors data: market direction, the movers, where foreign money went, what insiders did, and next week's agenda."
          />
        </p>
      </motion.header>

      <section className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi i={0} label="IHSG" value={pctS(st.ihsg)} tone={(st.ihsg ?? 0) >= 0 ? "text-up" : "text-down"} note={w.ihsg_days.length ? price(w.ihsg_days[w.ihsg_days.length - 1].v, lang) : undefined} />
        <Kpi i={1} label={tx({ id: "Saham naik vs turun", en: "Stocks up vs down" })} value={`${st.up} : ${st.down}`} tone={breadth >= 0.5 ? "text-up" : "text-down"} note={tx({ id: `${Math.round(breadth * 100)}% saham naik`, en: `${Math.round(breadth * 100)}% of stocks rose` })} />
        <Kpi i={2} label={tx({ id: "Asing bersih", en: "Foreign net" })} value={idr(st.foreign, lang)} tone={st.foreign >= 0 ? "text-up" : "text-down"} note={tx({ id: "seluruh pasar, sepekan", en: "whole market, the week" })} />
        <Kpi i={3} label={tx({ id: "45 saham paling likuid", en: "45 most liquid stocks" })} value={`${st.big_up}/${st.big_n}`} tone={st.big_up / Math.max(1, st.big_n) >= 0.5 ? "text-up" : "text-down"} note={tx({ id: `naik · median ${pctS(st.big_med)}`, en: `rose · median ${pctS(st.big_med)}` })} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title={tx({ id: "IHSG per hari", en: "IHSG by day" })}>
          <DayBars days={w.ihsg_days.map((x) => ({ d: x.d, v: x.chg }))} fmt={(v) => pctS(v)} />
        </Panel>
        <Panel title={tx({ id: "Dana asing per hari", en: "Foreign flow by day" })}>
          <DayBars days={w.foreign.days.map((x) => ({ d: x.d, v: x.net }))} fmt={(v) => idr(v, lang)} />
        </Panel>
      </section>

      <WeekLookup w={w} ranked={isRanked} />

      {/* the read */}
      <section className="mt-12 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-aqua/5 p-5 ring-1 ring-aqua/25">
          <h2 className="flex items-center gap-2 text-[16px] font-semibold text-[#7fd4a8]">
            <ThumbsUp size={17} /> <T id="Yang mendukung" en="What supports" />
          </h2>
          <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-ink-2">
            {w.reads.pos.map((r, i) => (
              <li key={i} className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7fd4a8]" />{tx(r)}</li>
            ))}
            {w.reads.pos.length === 0 && <li className="text-muted">{tx({ id: "Pekan ini tidak ada sisi positif yang menonjol dari data.", en: "No clear positive in the data this week." })}</li>}
          </ul>
        </div>
        <div className="rounded-2xl bg-down/5 p-5 ring-1 ring-down/25">
          <h2 className="flex items-center gap-2 text-[16px] font-semibold text-[#f0a3a3]">
            <ShieldAlert size={17} /> <T id="Yang perlu diwaspadai" en="What to be careful about" />
          </h2>
          <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-ink-2">
            {w.reads.neg.map((r, i) => (
              <li key={i} className="flex gap-2.5"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#f0a3a3]" />{tx(r)}</li>
            ))}
            {w.reads.neg.length === 0 && <li className="text-muted">{tx({ id: "Pekan ini tidak ada sisi waspada yang menonjol dari data.", en: "No clear warning in the data this week." })}</li>}
          </ul>
        </div>
      </section>

      {/* movers */}
      <section className="mt-12 grid gap-4 lg:grid-cols-2">
        <Panel title={tx({ id: "Naik paling tinggi", en: "Top gainers" })} note={tx({ id: "Hanya saham dengan transaksi ≥ Rp1 miliar/hari.", en: "Only stocks trading ≥ IDR 1B a day." })}>
          <ul>{w.gainers.map((m) => <StockLine key={m.s} s={m.s} name={m.name} ranked={isRanked.has(m.s)} right={<span className="text-up">{pctS(m.ret)}</span>} sub={price(m.close, lang)} />)}</ul>
        </Panel>
        <Panel title={tx({ id: "Turun paling dalam", en: "Top losers" })} note={tx({ id: "Hanya saham dengan transaksi ≥ Rp1 miliar/hari.", en: "Only stocks trading ≥ IDR 1B a day." })}>
          <ul>{w.losers.map((m) => <StockLine key={m.s} s={m.s} name={m.name} ranked={isRanked.has(m.s)} right={<span className="text-down">{pctS(m.ret)}</span>} sub={price(m.close, lang)} />)}</ul>
        </Panel>
      </section>
      {w.raw_top[0] && w.raw_top[0].s !== w.gainers[0]?.s && (
        <p className="mt-2 text-[12px] text-muted">
          {tx({
            id: `Kenapa disaring? Tanpa saringan, juara pekan ini ${w.raw_top[0].s} (${pctS(w.raw_top[0].ret, 0)}) dengan transaksi sepekan hanya ${idr(w.raw_top[0].val, "id")}. Kenaikan setipis itu mudah digerakkan segelintir order.`,
            en: `Why filter? Unfiltered, the week's top name was ${w.raw_top[0].s} (${pctS(w.raw_top[0].ret, 0)}) on just ${idr(w.raw_top[0].val, "en")} traded all week. A move that thin takes only a few orders.`,
          })}
        </p>
      )}

      <section className="mt-12 grid gap-4 lg:grid-cols-2">
        <Panel title={tx({ id: "Paling diborong asing", en: "Most bought by foreigners" })}>
          <ul>{w.foreign.buy.map((m) => <StockLine key={m.s} s={m.s} name={m.name} ranked={isRanked.has(m.s)} right={<span className="text-up">{idr(m.net, lang)}</span>} sub={pctS(m.ret)} />)}</ul>
        </Panel>
        <Panel title={tx({ id: "Paling dilepas asing", en: "Most sold by foreigners" })}>
          <ul>{w.foreign.sell.map((m) => <StockLine key={m.s} s={m.s} name={m.name} ranked={isRanked.has(m.s)} right={<span className="text-down">{idr(m.net, lang)}</span>} sub={pctS(m.ret)} />)}</ul>
        </Panel>
      </section>

      <section className="mt-12 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel title={tx({ id: "Sektor sepekan", en: "Sectors this week" })} note={tx({ id: "Median perubahan harga saham di tiap sektor.", en: "Median price change of the stocks in each sector." })}>
          <ul className="space-y-2">
            {w.sectors.map((x, i) => (
              <li key={x.sector} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_3.5rem] items-center gap-3 text-[12.5px]">
                <span className="truncate text-ink-2">{sec(x.sector)}</span>
                <span className="relative h-3">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
                  <motion.span
                    initial={{ width: 0 }}
                    whileInView={{ width: `${(Math.abs(x.ret) / maxSec) * 50}%` }}
                    viewport={{ once: true }}
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
        <Panel title={tx({ id: "Volume paling tidak biasa", en: "Most unusual volume" })} note={tx({ id: "Hari tersibuk pekan ini dibanding transaksi biasanya.", en: "The week's busiest day against the stock's usual value traded." })}>
          <ul>
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
      </section>

      <section className="mt-12 grid gap-4 lg:grid-cols-2">
        <Panel
          title={tx({ id: "Orang dalam pekan ini", en: "Insiders this week" })}
          note={tx({ id: `${w.insiders.n} laporan transaksi pasar · beli ${idr(w.insiders.buy, "id")} · jual ${idr(w.insiders.sell, "id")}`, en: `${w.insiders.n} market-trade filings · bought ${idr(w.insiders.buy, "en")} · sold ${idr(w.insiders.sell, "en")}` })}
        >
          <ul>
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
        <Panel title={tx({ id: "Pekan depan", en: "Next week" })} note={tx({ id: `Ditambah ${w.n_agm} RUPS dalam 90 hari ke depan.`, en: `Plus ${w.n_agm} AGMs over the next 90 days.` })}>
          <ul>
            {w.ahead.slice(0, 7).map((it) => (
              <StockLine
                key={`${it.type}-${it.s}`}
                s={it.s}
                ranked={isRanked.has(it.s)}
                name={tx(AGENDA_LABEL[it.type].label)}
                right={<span className="text-ink-2">{dateLabel(it.date, lang, { year: undefined })}</span>}
                sub={detail(it)}
              />
            ))}
          </ul>
          <Link href="/agenda/" className="mt-3 inline-flex items-center gap-1 text-[13px] text-arus hover:underline">
            {tx({ id: "Kalender lengkap", en: "Full calendar" })} <ArrowUpRight size={14} />
          </Link>
        </Panel>
      </section>

      {w.cooling.length > 0 && (
        <p className="mt-6 text-[13px] text-ink-2">
          {tx({ id: "Dihentikan sementara (cooling down) pekan ini: ", en: "Halted for cooling-down this week: " })}
          <span className="font-medium text-warn">{w.cooling.join(", ")}</span>
        </p>
      )}

      <p className="mt-10 max-w-[75ch] text-[13px] leading-relaxed text-muted">
        <T
          id="Harga, volume, dan dana asing dari ringkasan resmi BEI (dana asing dinilai pada harga rata-rata harian); orang dalam dan agenda dari Sectors. Kalimat “mendukung” dan “waspada” disusun otomatis dari angka di halaman ini, bukan ramalan. Informasi, bukan nasihat keuangan."
          en="Prices, volume and foreign flow from the official IDX summary (foreign flow valued at the daily average price); insiders and agenda from Sectors. The “supports” and “careful” lines are built automatically from the numbers on this page, not forecasts. Information, not financial advice."
        />
      </p>
    </div>
  );
}

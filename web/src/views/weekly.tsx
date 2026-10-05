"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, ShieldAlert, ThumbsUp } from "lucide-react";
import { useMemo, useState } from "react";
import { WeekMap, type MapItem, type MapMode } from "@/components/charts/week-map";
import { Segmented } from "@/components/ui";
import { useAgendaDetail } from "@/components/agenda";
import { ShareCard } from "@/components/share";
import { WeekLookup } from "@/components/week-lookup";
import { WEEKLY_CARD } from "@/lib/cards";
import { C } from "@/components/charts/kit";
import { AGENDA_LABEL } from "@/lib/agenda";
import { dateLabel, idr, signed } from "@/lib/format";
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

/** Horizontal bars from a centre line: one row per stock, the value written at the bar's end. */
function DivBars({ rows, ranked, fmt }: { rows: { s: string; name: string | null; v: number }[]; ranked: Set<string>; fmt: (v: number) => string }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.v)), 1e-12);
  return (
    <ul className="space-y-1.5">
      {rows.map((r, i) => (
        <li key={`${r.s}-${i}`} className="grid grid-cols-[3.4rem_minmax(0,1fr)_5.2rem] items-center gap-2.5 text-[12.5px]">
          {ranked.has(r.s) ? (
            <Link href={`/saham/${r.s}/`} className="font-semibold text-ink hover:text-arus" title={r.name ?? undefined}>{r.s}</Link>
          ) : (
            <span className="font-semibold text-ink" title={r.name ?? undefined}>{r.s}</span>
          )}
          <span className="relative h-3.5">
            <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
            <motion.span
              initial={{ width: 0 }}
              whileInView={{ width: `${(Math.abs(r.v) / max) * 50}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: i * 0.03, ease: EASE }}
              className="absolute inset-y-0 rounded-sm"
              style={{ background: r.v >= 0 ? C.up : C.down, ...(r.v >= 0 ? { left: "50%" } : { right: "50%" }) }}
            />
          </span>
          <span className={`num text-right ${r.v >= 0 ? "text-up" : "text-down"}`}>{fmt(r.v)}</span>
        </li>
      ))}
    </ul>
  );
}

export function WeeklyView({ w, ranked }: { w: WeeklyRecap; ranked: string[] }) {
  const { tx, lang } = useLang();
  const detail = useAgendaDetail();
  const isRanked = useMemo(() => new Set(ranked), [ranked]);
  const [mode, setMode] = useState<MapMode>("price");
  const st = w.stats;
  const sec = (x: string) => (lang === "id" ? x : IDX_SECTOR_EN[x] ?? x);
  const pctS = (x: number | null | undefined, d = 1) => signed(x == null ? null : x * 100, d, "%");
  const maxSec = Math.max(...w.sectors.map((x) => Math.abs(x.ret)), 1e-9);
  const breadth = st.up / Math.max(1, st.up + st.down);

  const red = (st.ihsg ?? 0) < 0;
  const mood = red
    ? (st.ihsg ?? 0) <= -0.02 || st.down > st.up * 2
      ? tx({ id: "Pekan merah", en: "A red week" })
      : tx({ id: "Pekan melemah", en: "A soft week" })
    : (st.ihsg ?? 0) >= 0.02
      ? tx({ id: "Pekan hijau", en: "A green week" })
      : tx({ id: "Pekan menguat tipis", en: "A modestly firm week" });

  // the 220 most traded stocks: enough to show the market's shape, few enough to read the tiles
  const items: MapItem[] = useMemo(
    () =>
      Object.entries(w.lookup ?? {})
        .map(([s, r]) => ({ s, name: w.names[s] ?? null, ret: r[0], fnet: r[1], val: r[2], sector: r[3] }))
        .filter((x) => x.val > 0)
        .sort((a, b) => b.val - a.val)
        .slice(0, 220),
    [w],
  );
  const movers = [...w.gainers.slice(0, 6).map((m) => ({ s: m.s, name: m.name, v: m.ret })), ...w.losers.slice(0, 6).reverse().map((m) => ({ s: m.s, name: m.name, v: m.ret }))];
  const flows = [...w.foreign.buy.slice(0, 6).map((m) => ({ s: m.s, name: m.name, v: m.net })), ...w.foreign.sell.slice(0, 6).reverse().map((m) => ({ s: m.s, name: m.name, v: m.net }))];

  return (
    <div className="pt-7 sm:pt-9">
      {/* 1 · the week, one line and four numbers */}
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-arus">
            <T id="Rekap pekan" en="Week in review" /> · <span className="num">{dateLabel(w.from, lang, { year: undefined })} – {dateLabel(w.to, lang)}</span>
          </span>
          <ShareCard file={WEEKLY_CARD} />
        </div>
        <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] sm:text-[2.2rem]">
          <span className={red ? "text-down" : "text-up"}>{mood}.</span>{" "}
          {tx({ id: `IHSG ${pctS(st.ihsg)}, asing ${st.foreign >= 0 ? "masuk" : "keluar"} ${idr(Math.abs(st.foreign), "id")}.`, en: `IHSG ${pctS(st.ihsg)}, foreigners ${st.foreign >= 0 ? "in" : "out"} ${idr(Math.abs(st.foreign), "en")}.` })}
        </h1>
        <div className="mt-5 grid grid-cols-2 divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line sm:grid-cols-4 sm:divide-x">
          <div className="px-4 py-3">
            <div className="text-[11.5px] text-muted">IHSG</div>
            <div className={`num text-xl font-semibold ${red ? "text-down" : "text-up"}`}>{pctS(st.ihsg)}</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-[11.5px] text-muted">{tx({ id: "Naik : turun", en: "Up : down" })}</div>
            <div className="num text-xl font-semibold text-ink">
              <span className="text-up">{st.up}</span> : <span className="text-down">{st.down}</span>
            </div>
            <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full">
              <span className="h-full bg-up" style={{ width: `${breadth * 100}%` }} />
              <span className="h-full flex-1 bg-down" />
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="text-[11.5px] text-muted">{tx({ id: "Asing bersih", en: "Foreign net" })}</div>
            <div className={`num text-xl font-semibold ${st.foreign >= 0 ? "text-up" : "text-down"}`}>{idr(st.foreign, lang)}</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-[11.5px] text-muted">{tx({ id: "Saham paling likuid yang naik", en: "Most liquid stocks up" })}</div>
            <div className="num text-xl font-semibold text-ink">
              {st.big_up}
              <span className="text-[13px] font-normal text-muted">/{st.big_n}</span>
            </div>
          </div>
        </div>
      </motion.header>

      {/* 2 · the map */}
      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{tx({ id: "Peta pasar sepekan", en: "The week's market map" })}</h2>
            <p className="text-[12.5px] text-muted">
              {tx({ id: `${items.length} saham paling ramai, dikelompokkan per sektor. Besar kotak = nilai transaksi sepekan.`, en: `The ${items.length} most traded stocks, grouped by sector. Tile size = value traded this week.` })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-[11px] text-muted sm:flex">
              {mode === "price" ? "−8%" : tx({ id: "jual", en: "sell" })}
              <span className="h-2 w-28 rounded-full" style={{ background: "linear-gradient(90deg, rgba(230,103,103,0.94), rgba(148,163,184,0.15), rgba(57,135,229,0.94))" }} />
              {mode === "price" ? "+8%" : tx({ id: "beli", en: "buy" })}
            </span>
            <Segmented<MapMode>
              label={tx({ id: "Warna peta", en: "Map colour" })}
              value={mode}
              onChange={setMode}
              options={[
                { value: "price", label: tx({ id: "Harga sepekan", en: "Weekly price" }) },
                { value: "foreign", label: tx({ id: "Arus asing", en: "Foreign flow" }) },
              ]}
            />
          </div>
        </div>
        <div className="mt-3 rounded-2xl bg-surface p-2 ring-1 ring-line">
          <div className="hidden md:block">
            <WeekMap items={items} mode={mode} ranked={isRanked} height={580} />
          </div>
          <div className="md:hidden">
            <WeekMap items={items.slice(0, 90)} mode={mode} ranked={isRanked} height={520} />
          </div>
        </div>
      </section>

      {/* 3 · the week by day and by sector */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel title={tx({ id: "IHSG per hari", en: "IHSG by day" })}>
          <DayBars days={w.ihsg_days.map((x) => ({ d: x.d, v: x.chg }))} fmt={(v) => pctS(v)} />
        </Panel>
        <Panel title={tx({ id: "Dana asing per hari", en: "Foreign flow by day" })}>
          <DayBars days={w.foreign.days.map((x) => ({ d: x.d, v: x.net }))} fmt={(v) => idr(v, lang)} />
        </Panel>
        <Panel title={tx({ id: "Sektor (median)", en: "Sectors (median)" })}>
          <ul className="space-y-1.5">
            {w.sectors.map((x, i) => (
              <li key={x.sector} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_3.2rem] items-center gap-2 text-[11.5px]">
                <span className="truncate text-ink-2">{sec(x.sector)}</span>
                <span className="relative h-2">
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
      </section>

      {/* 4 · who moved, who money moved into */}
      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title={tx({ id: "Naik dan turun paling jauh", en: "Biggest moves" })} note={tx({ id: "Saham dengan transaksi ≥ Rp1 miliar/hari", en: "Stocks trading ≥ IDR 1B a day" })}>
          <DivBars rows={movers} ranked={isRanked} fmt={(v) => pctS(v)} />
        </Panel>
        <Panel title={tx({ id: "Diborong dan dilepas asing", en: "Foreign buying and selling" })} note={tx({ id: "Nilai bersih sepekan", en: "Net value for the week" })}>
          <DivBars rows={flows} ranked={isRanked} fmt={(v) => idr(v, lang)} />
        </Panel>
      </section>

      {/* 5 · read, look up, look ahead */}
      <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title={tx({ id: "Bacaan pekan ini", en: "This week's read" })}>
          <ul className="space-y-1.5 text-[13.5px] leading-relaxed text-ink-2">
            {w.reads.pos.map((r, i) => (
              <li key={`p${i}`} className="flex gap-2.5">
                <ThumbsUp size={14} className="mt-1 shrink-0 text-[#7fd4a8]" />
                {tx(r)}
              </li>
            ))}
            {w.reads.neg.map((r, i) => (
              <li key={`n${i}`} className="flex gap-2.5">
                <ShieldAlert size={14} className="mt-1 shrink-0 text-[#f0a3a3]" />
                {tx(r)}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={tx({ id: "Pekan depan", en: "Next week" })}>
          <ul>
            {w.ahead.slice(0, 6).map((it) => (
              <StockLine key={`${it.type}-${it.s}`} s={it.s} ranked={isRanked.has(it.s)} name={tx(AGENDA_LABEL[it.type].label)} right={<span className="text-ink-2">{dateLabel(it.date, lang, { year: undefined })}</span>} sub={detail(it)} />
            ))}
          </ul>
          <Link href="/agenda/" className="mt-2 inline-flex items-center gap-1 text-[13px] text-arus hover:underline">
            {tx({ id: "Kalender lengkap", en: "Full calendar" })} <ArrowUpRight size={14} />
          </Link>
        </Panel>
      </section>

      <WeekLookup w={w} ranked={isRanked} />

      <p className="mt-8 max-w-[75ch] text-[12.5px] leading-relaxed text-muted">
        <T
          id="Harga, volume, dan dana asing dari ringkasan resmi BEI (dana asing dinilai pada harga rata-rata harian); agenda dari Sectors. Bacaan pekan disusun otomatis dari angka di halaman ini, bukan ramalan. Informasi, bukan nasihat keuangan."
          en="Prices, volume and foreign flow from the official IDX summary (foreign flow valued at the daily average price); agenda from Sectors. The read is built automatically from the numbers on this page, not a forecast. Information, not financial advice."
        />
      </p>
    </div>
  );
}

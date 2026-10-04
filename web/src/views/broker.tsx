"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cohortDot } from "@/components/broker-summary";
import { STYLE } from "@/components/brokers";
import { Segmented } from "@/components/ui";
import { idr, price, signed } from "@/lib/format";
import { T, useLang, type Bi } from "@/lib/i18n";
import type { BrokerIndex, BrokerStyle } from "@/lib/types";

const EASE = [0.23, 1, 0.32, 1] as const;

export const COHORT_LABEL: Record<string, Bi> = {
  institutional: { id: "Institusi", en: "Institutional" },
  retail: { id: "Ritel", en: "Retail" },
  mixed: { id: "Campuran", en: "Mixed" },
  unknown: { id: "Tidak diketahui", en: "Unknown" },
};

export type DirectoryRow = {
  code: string;
  name: string | null;
  cohort: string | null;
  foreign: boolean;
  gross: number;
  net: number;
  n_stocks: number;
  acc: { s: string; net: number }[];
  dist: { s: string; net: number }[];
};

/** Every broker, searchable by code or name, with where it is piling in and out. */
export function BrokerDirectory({ rows, period }: { rows: DirectoryRow[]; period: string }) {
  const { tx, lang } = useLang();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "institutional" | "retail" | "foreign">("all");
  const shown = rows.filter((r) => {
    const t = q.trim().toLowerCase();
    if (t && !r.code.toLowerCase().includes(t) && !(r.name ?? "").toLowerCase().includes(t)) return false;
    if (kind === "foreign") return r.foreign;
    if (kind !== "all") return r.cohort === kind;
    return true;
  });
  return (
    <div className="pt-10 sm:pt-12">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="max-w-3xl">
        <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-balance sm:text-5xl">
          <T id="Direktori broker" en="Broker directory" />
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
          {tx({
            id: `Setiap broker anggota bursa: di saham mana ia paling banyak mengumpulkan dan melepas selama ${period}, dari 120 saham yang dipantau Arus. Klik broker untuk melihat seluruh jejak dan gaya belinya.`,
            en: `Every exchange-member broker: where it has been accumulating and unloading most over ${period}, across the 120 stocks Arus tracks. Click a broker for its full footprint and buying style.`,
          })}
        </p>
      </motion.header>

      <div className="sticky top-[94px] z-30 -mx-4 mt-8 flex flex-wrap items-center gap-3 border-y border-line bg-ground/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-14">
        <label className="flex h-10 min-w-56 flex-1 items-center gap-2 rounded-lg bg-surface px-3 ring-1 ring-line focus-within:ring-arus/60 sm:max-w-80">
          <Search size={15} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx({ id: "Cari kode atau nama broker", en: "Search broker code or name" })} className="w-full bg-transparent text-[13.5px] text-ink placeholder:text-muted focus:outline-none" />
        </label>
        <Segmented
          label={tx({ id: "Jenis broker", en: "Broker type" })}
          value={kind}
          onChange={setKind}
          options={[
            { value: "all", label: tx({ id: "Semua", en: "All" }) },
            { value: "institutional", label: tx(COHORT_LABEL.institutional) },
            { value: "retail", label: tx(COHORT_LABEL.retail) },
            { value: "foreign", label: tx({ id: "Asing", en: "Foreign" }) },
          ]}
        />
        <span className="text-[12.5px] text-muted">{tx({ id: `${shown.length} broker`, en: `${shown.length} brokers` })}</span>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((r) => (
          <Link key={r.code} href={`/broker/${r.code}/`} className="group rounded-2xl bg-surface p-4 ring-1 ring-line transition-colors duration-150 hover:ring-line-strong">
            <div className="flex items-baseline gap-2">
              {cohortDot(r.cohort, r.foreign)}
              <span className="text-[17px] font-semibold text-ink group-hover:text-arus">{r.code}</span>
              <span className="min-w-0 truncate text-[12px] text-muted">{r.name}</span>
            </div>
            <div className="mt-1 text-[11.5px] text-muted">
              {tx(COHORT_LABEL[r.cohort ?? "unknown"] ?? COHORT_LABEL.unknown)}
              {r.foreign ? ` · ${tx({ id: "asing", en: "foreign" })}` : ""} · {tx({ id: `aktif di ${r.n_stocks} saham`, en: `active in ${r.n_stocks} stocks` })} · {idr(r.gross, lang)}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-[12.5px]">
              {[
                { t: { id: "Mengumpulkan", en: "Accumulating" }, l: r.acc, c: "text-up" },
                { t: { id: "Melepas", en: "Unloading" }, l: r.dist, c: "text-down" },
              ].map((col) => (
                <div key={col.t.en}>
                  <div className="mb-1 text-muted">{tx(col.t)}</div>
                  {col.l.length === 0 && <div className="text-muted">–</div>}
                  {col.l.map((x) => (
                    <div key={x.s} className="flex justify-between gap-2">
                      <span className="font-medium text-ink">{x.s}</span>
                      <span className={`num ${col.c}`}>{idr(Math.abs(x.net), lang)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Link>
        ))}
      </div>
      {shown.length === 0 && (
        <p className="py-14 text-center text-[14px] text-muted">
          <T id="Tidak ada broker yang cocok." en="No broker matches." />
        </p>
      )}
    </div>
  );
}

type Detail = BrokerIndex[string] & { code: string };

/** One broker across every tracked stock: where it buys, at what price, how, and what followed. */
export function BrokerDetail({ b, names, prices, period }: { b: Detail; names: Record<string, string | null>; prices: Record<string, number | null>; period: string }) {
  const { tx, lang } = useLang();
  const [q, setQ] = useState("");
  const [side, setSide] = useState<"all" | "buy" | "sell">("all");
  const acc = [...b.stocks].filter((x) => x.net > 0).sort((a, z) => z.net - a.net).slice(0, 5);
  const dist = [...b.stocks].filter((x) => x.net < 0).sort((a, z) => a.net - z.net).slice(0, 5);
  const styles = useMemo(() => {
    const c: Partial<Record<BrokerStyle, number>> = {};
    b.stocks.forEach((x) => (c[x.style] = (c[x.style] ?? 0) + 1));
    return Object.entries(c).filter(([k]) => k !== "mixed").sort((a, z) => (z[1] as number) - (a[1] as number)) as [BrokerStyle, number][];
  }, [b.stocks]);
  const follows = b.stocks.filter((x) => x.follow3 != null && x.n_follow > 0);
  const nF = follows.reduce((a, x) => a + x.n_follow, 0);
  const avgF = nF ? follows.reduce((a, x) => a + (x.follow3 as number) * x.n_follow, 0) / nF : null;
  const rows = b.stocks
    .filter((x) => (side === "buy" ? x.net > 0 : side === "sell" ? x.net < 0 : true))
    .filter((x) => !q.trim() || x.s.toLowerCase().includes(q.trim().toLowerCase()) || (names[x.s] ?? "").toLowerCase().includes(q.trim().toLowerCase()));

  const gapOf = (x: { s: string; avg_buy: number | null; avg_sell: number | null; net: number }) => {
    const p = prices[x.s];
    const avg = x.net >= 0 ? x.avg_buy : x.avg_sell;
    return p && avg ? p / avg - 1 : null;
  };

  return (
    <div className="pt-6 sm:pt-8">
      <Link href="/broker/" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} />
        <T id="Semua broker" en="All brokers" />
      </Link>
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} className="mt-4 rounded-2xl bg-surface p-5 ring-1 ring-line sm:p-6">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{b.code}</h1>
          <span className="text-[15px] text-ink-2">{b.name}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
          {cohortDot(b.cohort, b.foreign)}
          {tx(COHORT_LABEL[b.cohort ?? "unknown"] ?? COHORT_LABEL.unknown)}
          {b.foreign ? ` · ${tx({ id: "broker asing", en: "foreign broker" })}` : ""} · {period}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 sm:grid-cols-4">
          <div>
            <dt className="text-[11.5px] text-muted">{tx({ id: "Nilai transaksi", en: "Traded value" })}</dt>
            <dd className="num text-[16px] text-ink">{idr(b.gross, lang)}</dd>
          </div>
          <div>
            <dt className="text-[11.5px] text-muted">{tx({ id: "Bersih", en: "Net" })}</dt>
            <dd className={`num text-[16px] ${b.net >= 0 ? "text-up" : "text-down"}`}>
              {b.net >= 0 ? tx({ id: "beli", en: "bought" }) : tx({ id: "jual", en: "sold" })} {idr(Math.abs(b.net), lang)}
            </dd>
          </div>
          <div>
            <dt className="text-[11.5px] text-muted">{tx({ id: "Aktif di", en: "Active in" })}</dt>
            <dd className="num text-[16px] text-ink">{tx({ id: `${b.n_stocks} saham`, en: `${b.n_stocks} stocks` })}</dd>
          </div>
          <div>
            <dt className="text-[11.5px] text-muted">{tx({ id: "3 hari setelah ia beli", en: "3 days after it buys" })}</dt>
            <dd className={`num text-[16px] ${avgF == null ? "text-muted" : avgF >= 0 ? "text-up" : "text-down"}`}>
              {avgF == null ? "–" : `${signed(avgF * 100, 1, "%")}`}
              {nF > 0 && <span className="ml-1 text-[11.5px] text-muted">({nF}×)</span>}
            </dd>
          </div>
        </dl>
        {styles.length > 0 && (
          <p className="mt-4 text-[13.5px] leading-relaxed text-ink-2">
            {tx({ id: "Kebiasaan yang paling sering terlihat: ", en: "Most common habits: " })}
            {styles.slice(0, 3).map(([k, n], i) => (
              <span key={k}>
                {i > 0 && ", "}
                <span className="font-medium text-ink">{tx(STYLE[k].label).toLowerCase()}</span> ({tx({ id: `${n} saham`, en: `${n} stocks` })})
              </span>
            ))}
            .
          </p>
        )}
      </motion.header>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {[
          { t: { id: "Paling banyak dikumpulkan", en: "Accumulating most" }, l: acc, c: "text-up" },
          { t: { id: "Paling banyak dilepas", en: "Unloading most" }, l: dist, c: "text-down" },
        ].map((col) => (
          <section key={col.t.en} className="rounded-2xl bg-surface p-5 ring-1 ring-line">
            <h2 className="text-[15px] font-semibold">{tx(col.t)}</h2>
            <ul className="mt-3 divide-y divide-line">
              {col.l.length === 0 && <li className="py-2 text-[13px] text-muted">–</li>}
              {col.l.map((x) => {
                const g = gapOf(x);
                return (
                  <li key={x.s}>
                    <Link href={`/saham/${x.s}/`} className="flex items-center gap-3 py-2.5 hover:text-arus">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold">{x.s}</span>
                        <span className="block truncate text-[11.5px] text-muted">{names[x.s]}</span>
                      </span>
                      <span className="text-right">
                        <span className={`num block text-[14px] ${col.c}`}>{idr(Math.abs(x.net), lang)}</span>
                        <span className="num block text-[11.5px] text-muted">
                          @{price(x.net >= 0 ? x.avg_buy : x.avg_sell, lang)}
                          {g != null && <span className={g >= 0 ? "text-up" : "text-down"}> ({signed(g * 100, 1, "%")})</span>}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            <T id="Semua saham yang ditransaksikan" en="Every stock it traded" />
          </h2>
          <label className="ml-auto flex h-9 min-w-48 items-center gap-2 rounded-lg bg-surface px-3 ring-1 ring-line focus-within:ring-arus/60">
            <Search size={14} className="text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx({ id: "Cari saham", en: "Search stock" })} className="w-full bg-transparent text-[13px] text-ink placeholder:text-muted focus:outline-none" />
          </label>
          <Segmented
            label={tx({ id: "Arah", en: "Side" })}
            value={side}
            onChange={setSide}
            options={[
              { value: "all", label: tx({ id: "Semua", en: "All" }) },
              { value: "buy", label: tx({ id: "Beli bersih", en: "Net buy" }) },
              { value: "sell", label: tx({ id: "Jual bersih", en: "Net sell" }) },
            ]}
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr className="text-right text-xs text-muted">
                <th className="py-2.5 pr-4 text-left font-normal">{tx({ id: "Saham", en: "Stock" })}</th>
                <th className="py-2.5 pr-4 font-normal">{tx({ id: "Bersih", en: "Net" })}</th>
                <th className="py-2.5 pr-4 font-normal">{tx({ id: "Harga rata-rata", en: "Avg price" })}</th>
                <th className="py-2.5 pr-4 font-normal">{tx({ id: "vs harga kini", en: "vs price now" })}</th>
                <th className="py-2.5 pr-4 font-normal">{tx({ id: "Hari beli / jual", en: "Buy / sell days" })}</th>
                <th className="py-2.5 pr-4 text-left font-normal">{tx({ id: "Gaya", en: "Style" })}</th>
                <th className="py-2.5 font-normal">{tx({ id: "Peringkat di saham itu", en: "Rank in that stock" })}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => {
                const g = gapOf(x);
                return (
                  <tr key={x.s} className="num text-right hover:bg-surface">
                    <td className="border-t border-line py-2 pr-4 text-left">
                      <Link href={`/saham/${x.s}/`} className="font-semibold text-ink hover:text-arus">
                        {x.s}
                      </Link>
                    </td>
                    <td className={`border-t border-line py-2 pr-4 ${x.net >= 0 ? "text-up" : "text-down"}`}>{idr(x.net, lang)}</td>
                    <td className="border-t border-line py-2 pr-4 text-ink-2">{price(x.net >= 0 ? x.avg_buy : x.avg_sell, lang)}</td>
                    <td className={`border-t border-line py-2 pr-4 ${g == null ? "text-muted" : g >= 0 ? "text-up" : "text-down"}`}>{g == null ? "–" : signed(g * 100, 1, "%")}</td>
                    <td className="border-t border-line py-2 pr-4 text-ink-2">
                      {x.days_buy} / {x.days_sell}
                    </td>
                    <td className="border-t border-line py-2 pr-4 text-left">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ${STYLE[x.style].tone}`}>{tx(STYLE[x.style].label)}</span>
                    </td>
                    <td className="border-t border-line py-2 text-ink-2">#{x.rank}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          <T
            id="“vs harga kini” membandingkan harga penutupan terakhir dengan harga rata-rata beli (atau jual) broker ini. Peringkat #1 berarti broker paling aktif di saham itu. Data broker harian dari Sectors; periodenya beberapa minggu, jadi ini kebiasaan terbaru, bukan pola yang terbukti."
            en="“vs price now” compares the last close with this broker's average buy (or sell) price. Rank #1 means the most active broker in that stock. Daily broker data from Sectors; the window is a few weeks, so these are recent habits, not proven patterns."
          />
        </p>
      </section>
    </div>
  );
}

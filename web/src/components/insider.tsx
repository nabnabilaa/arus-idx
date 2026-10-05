"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, FileText } from "lucide-react";
import { C } from "@/components/charts/kit";
import { Pager } from "@/components/pager";
import { ShareCard } from "@/components/share";
import { useState } from "react";
import { Badge } from "@/components/ui";
import { dateLabel, idr, pct, price, signed } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { chainCard } from "@/lib/cards";
import { filingDate, groupName, HOLDER_KIND, TAG_LABEL } from "@/lib/insider";
import type { InsiderAfter, InsiderChain, InsiderEvent } from "@/lib/types";

const EASE = [0.23, 1, 0.32, 1] as const;

const shares = (x: number | null | undefined, lang: "id" | "en") => {
  if (x == null || !Number.isFinite(x)) return "–";
  const a = Math.abs(x);
  const f = (v: number, u: string) => `${v.toLocaleString(lang === "id" ? "id-ID" : "en-US", { maximumFractionDigits: v >= 100 ? 0 : 1 })}${u}`;
  if (a >= 1e9) return f(a / 1e9, lang === "id" ? " M" : "B");
  if (a >= 1e6) return f(a / 1e6, lang === "id" ? " jt" : "M");
  if (a >= 1e3) return f(a / 1e3, lang === "id" ? " rb" : "K");
  return f(a, "");
};

/** Price line since the first trade, with a dot at every day the holder traded (size = shares). */
export function ChainChart({ path, trades, side, height = 120 }: { path?: { d: string[]; c: number[] }; trades: InsiderChain["trades"]; side: "buy" | "sell"; height?: number }) {
  if (!path || path.c.length < 2) return null;
  const W = 320;
  const H = height;
  const pad = 6;
  const pts = trades.filter((t) => t.d >= path.d[0]);
  const ys = [...path.c, ...pts.map((t) => t.px)];
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const x = (i: number) => pad + (i / (path.c.length - 1)) * (W - 2 * pad);
  const y = (v: number) => (hi === lo ? H / 2 : pad + (1 - (v - lo) / (hi - lo)) * (H - 2 * pad));
  const idx = (d: string) => {
    const i = path.d.findIndex((p) => p >= d);
    return i < 0 ? path.d.length - 1 : i;
  };
  const maxSh = Math.max(...pts.map((t) => t.sh), 1);
  const line = path.c.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const color = side === "buy" ? "#7fd4a8" : C.down;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-hidden>
      <path d={`${line}L${x(path.c.length - 1)},${H}L${x(0)},${H}Z`} fill={C.current} opacity={0.06} />
      <motion.path d={line} fill="none" stroke={C.current} strokeWidth={1.5} initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE }} />
      {pts.map((t, i) => (
        <motion.circle
          key={`${t.d}-${i}`}
          cx={x(idx(t.d))}
          cy={y(t.px)}
          r={2.5 + 3.5 * Math.sqrt(t.sh / maxSh)}
          fill={color}
          stroke="#070b14"
          strokeWidth={1}
          initial={{ scale: 0, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 0.9 }}
          viewport={{ once: true }}
          transition={{ duration: 0.25, delay: 0.5 + i * 0.03 }}
        />
      ))}
    </svg>
  );
}

export function ChainCard({ c, path, ranked, i = 0, card }: { c: InsiderChain; path?: { d: string[]; c: number[] }; ranked: boolean; i?: number; card?: string | null }) {
  const { tx, lang } = useLang();
  const buy = c.side === "buy";
  const grp = groupName(c.grp);
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: Math.min(i, 6) * 0.04, ease: EASE }}
      className="flex flex-col rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={buy ? "good" : "warn"}>{buy ? tx({ id: "RANTAI BELI", en: "BUY CHAIN" }) : tx({ id: "RANTAI JUAL", en: "SELL CHAIN" })}</Badge>
            {c.kind && HOLDER_KIND[c.kind] && <Badge>{tx(HOLDER_KIND[c.kind])}</Badge>}
            {grp && <Badge>{grp}</Badge>}
          </div>
          <h3 className="mt-2.5 text-[16px] font-semibold leading-snug text-ink">
            {c.holder}{" "}
            <span className="font-normal text-ink-2">{buy ? tx({ id: "membeli", en: "bought" }) : tx({ id: "menjual", en: "sold" })}</span>{" "}
            {ranked ? (
              <Link href={`/saham/${c.s}/`} className="text-arus hover:underline">{c.s}</Link>
            ) : (
              <span className="text-arus">{c.s}</span>
            )}{" "}
            <span className="font-normal text-ink-2">{tx({ id: `${c.n} kali`, en: `${c.n} times` })}</span>
          </h3>
          <p className="num mt-0.5 text-[12px] text-muted">
            {dateLabel(filingDate(c.first), lang, { year: undefined })} – {dateLabel(filingDate(c.last), lang)}
          </p>
        </div>
        {card && <ShareCard file={card} className="shrink-0" />}
      </div>
      <div className="mt-3">
        <ChainChart path={path} trades={c.trades} side={c.side} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-line pt-3 sm:grid-cols-4">
        <div>
          <dt className="text-[11px] text-muted">{tx({ id: "Total", en: "Total" })}</dt>
          <dd className="num text-[14px] text-ink">{idr(c.val, lang)}</dd>
          <dd className="num text-[11px] text-muted">{shares(c.sh, lang)} {tx({ id: "lembar", en: "shares" })}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted">{tx({ id: "Harga rata-rata", en: "Average price" })}</dt>
          <dd className="num text-[14px] text-ink">{price(c.avg, lang)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted">{tx({ id: "Kepemilikan", en: "Stake" })}</dt>
          <dd className="num text-[14px] text-ink">{c.pa != null ? `${c.pa.toLocaleString(lang === "id" ? "id-ID" : "en-US", { maximumFractionDigits: 2 })}%` : "–"}</dd>
          {c.pb != null && c.pa != null && (
            <dd className={`num text-[11px] ${c.pa >= c.pb ? "text-[#7fd4a8]" : "text-[#f0a3a3]"}`}>{signed(c.pa - c.pb, 2, lang === "id" ? " poin" : " pts")}</dd>
          )}
        </div>
        <div>
          <dt className="text-[11px] text-muted">{tx({ id: "Harga kini vs rata-rata", en: "Now vs average" })}</dt>
          <dd className={`num text-[14px] ${c.vs == null ? "text-muted" : c.vs >= 0 ? "text-up" : "text-down"}`}>{c.vs == null ? "–" : signed(c.vs * 100, 1, "%")}</dd>
          <dd className="num text-[11px] text-muted">{price(c.now, lang)}</dd>
        </div>
      </dl>
    </motion.article>
  );
}

export function FilingRow({ e, name, ranked, ksei, showSymbol = true }: { e: InsiderEvent; name?: string | null; ranked: boolean; ksei: string; showSymbol?: boolean }) {
  const { tx, lang } = useLang();
  const buy = e.side === "buy";
  const delta = e.pb != null && e.pa != null ? e.pa - e.pb : null;
  return (
    <li className="flex flex-col gap-2 rounded-xl bg-surface px-4 py-3 ring-1 ring-line sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${buy ? "bg-aqua/15 text-[#7fd4a8]" : "bg-down/15 text-[#f0a3a3]"}`}>
          {buy ? tx({ id: "BELI", en: "BUY" }) : tx({ id: "JUAL", en: "SELL" })}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {showSymbol &&
              (ranked ? (
                <Link href={`/saham/${e.s}/`} className="text-[14px] font-semibold text-ink hover:text-arus">{e.s}</Link>
              ) : (
                <span className="text-[14px] font-semibold text-ink">{e.s}</span>
              ))}
            <span className="text-[13px] text-ink-2">{e.holder}</span>
            {e.tags.map((t) => TAG_LABEL[t] && <Badge key={t}>{tx(TAG_LABEL[t])}</Badge>)}
            {e.twoway && (
              <span title={tx({ id: "Pemegang ini melapor beli dan jual di saham yang sama: biasanya perantara atau penjamin emisi, bukan keyakinan.", en: "This holder filed both buys and sells in the same stock: usually an intermediary or underwriter, not conviction." })}>
                <Badge>{tx({ id: "Dua arah", en: "Two-way" })}</Badge>
              </span>
            )}
          </div>
          <div className="num mt-0.5 text-[12px] text-muted">
            {dateLabel(filingDate(e.ts), lang)}
            {showSymbol && name ? ` · ${name.replace(/^PT\.? /, "").replace(/ Tbk\.?$/, "")}` : ""}
          </div>
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-3 gap-4 pl-11 text-right sm:pl-0">
        <div>
          <div className="num text-[13.5px] text-ink">{idr(e.val, lang)}</div>
          <div className="num text-[11px] text-muted">@ {price(e.px, lang)}</div>
        </div>
        <div>
          <div className="num text-[13.5px] text-ink">{e.pa != null ? `${e.pa.toLocaleString(lang === "id" ? "id-ID" : "en-US", { maximumFractionDigits: 2 })}%` : "–"}</div>
          <div className={`num text-[11px] ${delta == null ? "text-muted" : delta >= 0 ? "text-[#7fd4a8]" : "text-[#f0a3a3]"}`}>{delta == null ? "" : signed(delta, 2, lang === "id" ? " poin" : " pts")}</div>
        </div>
        <div>
          <div className={`num text-[13.5px] ${e.since == null ? "text-muted" : e.since >= 0 ? "text-up" : "text-down"}`}>{e.since == null ? "–" : signed(e.since * 100, 1, "%")}</div>
          <div className="text-[11px] text-muted">
            {e.url ? (
              <a href={`${ksei}${e.url}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-arus">
                <FileText size={11} /> KSEI
              </a>
            ) : (
              tx({ id: "sejak lapor", en: "since filing" })
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

/** "Of 100 filings like this, the stock beat a typical stock N times over 20 sessions." */
export function AfterCard({ label, note, a, i = 0 }: { label: string; note: string; a?: InsiderAfter; i?: number }) {
  const { tx } = useLang();
  const b20 = a?.beat20 != null ? Math.round(a.beat20 * 100) : null;
  const b5 = a?.beat5 != null ? Math.round(a.beat5 * 100) : null;
  const tone = (b: number | null) => (b == null ? "text-muted" : b >= 53 ? "text-[#9cc5f5]" : b <= 47 ? "text-[#f0a3a3]" : "text-ink");
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.06, ease: EASE }} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
      <div className="text-[13.5px] font-semibold text-ink">{label}</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <div className={`num text-2xl font-semibold ${tone(b5)}`}>{b5 ?? "–"}</div>
          <div className="text-[11px] text-muted">{tx({ id: "dari 100, 5 hari", en: "of 100, 5 days" })}</div>
        </div>
        <div>
          <div className={`num text-2xl font-semibold ${tone(b20)}`}>{b20 ?? "–"}</div>
          <div className="text-[11px] text-muted">{tx({ id: "dari 100, 20 hari", en: "of 100, 20 days" })}</div>
        </div>
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
        {note} {a ? tx({ id: `${a.n20.toLocaleString("id-ID")} kejadian dengan data 20 hari; median ${pct(a.med20, 1)} vs saham biasa.`, en: `${a.n20.toLocaleString("en-US")} events with 20-day data; median ${pct(a.med20, 1)} vs a typical stock.` }) : ""}
      </p>
    </motion.div>
  );
}

export function InsiderPanel({ events, chains, paths, ksei, cards = [] }: { events: InsiderEvent[]; chains: InsiderChain[]; paths: Record<string, { d: string[]; c: number[] }>; ksei: string; cards?: string[] }) {
  const { tx } = useLang();
  const [page, setPage] = useState(0);
  const PER = 15;
  const market = events.filter((e) => e.market && !e.twoway);
  const buys = market.filter((e) => e.side === "buy");
  const sells = market.filter((e) => e.side === "sell");
  const net = market.reduce((a, e) => a + (e.side === "buy" ? 1 : -1) * (e.val ?? 0), 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {[
          [tx({ id: "Laporan beli", en: "Buy filings" }), String(buys.length), "text-[#7fd4a8]"],
          [tx({ id: "Laporan jual", en: "Sell filings" }), String(sells.length), "text-[#f0a3a3]"],
          [tx({ id: "Bersih (transaksi pasar)", en: "Net (market trades)" }), idr(net), net >= 0 ? "text-[#7fd4a8]" : "text-[#f0a3a3]"],
        ].map(([l, v, t]) => (
          <div key={l} className="rounded-xl bg-surface p-4 ring-1 ring-line">
            <div className="text-[12px] text-muted">{l}</div>
            <div className={`num mt-1 text-xl font-semibold ${t}`}>{v}</div>
          </div>
        ))}
      </div>
      {chains.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {chains.slice(0, 4).map((c, i) => (
            <ChainCard key={`${c.holder}-${c.side}`} c={c} path={paths[c.s]} ranked i={i} card={cards.includes(chainCard(c)) ? chainCard(c) : null} />
          ))}
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {events.slice(page * PER, page * PER + PER).map((e, i) => (
          <FilingRow key={`${e.ts}-${e.holder}-${i}`} e={e} ranked ksei={ksei} showSymbol={false} />
        ))}
      </ul>
      {events.length > PER && <Pager page={page} pages={Math.ceil(events.length / PER)} total={events.length} per={PER} onChange={setPage} noun={{ id: "laporan", en: "filings" }} />}
      <p className="max-w-[75ch] text-[12px] leading-relaxed text-muted">
        {tx({
          id: "Laporan kepemilikan dari KSEI lewat Sectors, 90 hari terakhir. “Bersih” hanya menghitung transaksi pasar: repo (gadai), private placement, opsi saham karyawan, restrukturisasi, ambil alih, dan pemenuhan free float tidak dihitung. Kolom kanan: harga sekarang dibanding hari pertama laporan bisa diperdagangkan.",
          en: "KSEI ownership filings via Sectors, last 90 days. “Net” counts market trades only: repo pledges, private placements, employee options, restructurings, takeovers and free-float sales are left out. Right column: today's price against the first session the filing could be traded.",
        })}
      </p>
      <Link href="/orang-dalam/" className="inline-flex items-center gap-1 text-[13px] text-arus hover:underline">
        {tx({ id: "Semua laporan orang dalam", en: "All insider filings" })} <ArrowUpRight size={14} />
      </Link>
    </div>
  );
}

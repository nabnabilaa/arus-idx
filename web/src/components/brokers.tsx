"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { dateLabel, idr, price, signed } from "@/lib/format";
import { T, useLang, type Bi } from "@/lib/i18n";
import type { BrokerMap, BrokerProfile, NewsItem } from "@/lib/types";

const EASE = [0.23, 1, 0.32, 1] as const;

export const STYLE: Record<BrokerProfile["brokers"][number]["style"], { label: Bi; tone: string; explain: Bi }> = {
  chase: {
    label: { id: "Ikut saat ramai", en: "Buys into strength" },
    tone: "bg-warn/10 text-warn ring-warn/30",
    explain: { id: "Membeli di hari harga sudah naik dan volume ramai.", en: "Buys on days the price is already up and volume is heavy." },
  },
  absorb: {
    label: { id: "Menampung saat turun", en: "Buys the dips" },
    tone: "bg-up/10 text-[#9cc5f5] ring-up/30",
    explain: { id: "Membeli di hari harga sedang turun.", en: "Buys on days the price is falling." },
  },
  steady: {
    label: { id: "Beli rutin", en: "Steady buyer" },
    tone: "bg-aqua/10 text-[#7fd4a8] ring-aqua/30",
    explain: { id: "Membeli hampir setiap hari, tidak tergantung naik-turunnya harga.", en: "Buys almost every day regardless of the price move." },
  },
  sell_strength: {
    label: { id: "Jual saat naik", en: "Sells into strength" },
    tone: "bg-down/10 text-[#f0a3a3] ring-down/30",
    explain: { id: "Menjual di hari harga sedang naik, sering tanda ambil untung.", en: "Sells on rising days, often a sign of profit-taking." },
  },
  mixed: {
    label: { id: "Tanpa pola jelas", en: "No clear pattern" },
    tone: "bg-raised text-ink-2 ring-line-strong",
    explain: { id: "Beli dan jual bergantian tanpa pola yang menonjol.", en: "Alternates buying and selling with no standout pattern." },
  },
};

const COHORT: Record<string, Bi> = {
  institutional: { id: "institusi", en: "institutional" },
  retail: { id: "ritel", en: "retail" },
  mixed: { id: "campuran", en: "mixed" },
};

/** How each active broker trades this stock: who, how much, when they buy, and what followed. */
export function BrokerBehaviour({ p, last }: { p: BrokerProfile; last: number | null }) {
  const { tx, lang } = useLang();
  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-line">
      <h3 className="text-[16px] font-semibold">
        <T id="Perilaku broker di saham ini" en="How brokers trade this stock" />
      </h3>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        {tx({
          id: `Broker paling aktif ${dateLabel(p.start, lang)} – ${dateLabel(p.end, lang)} (${p.days} hari bursa): kapan mereka membeli dan apa yang terjadi sesudahnya.`,
          en: `Most active brokers ${dateLabel(p.start, lang)} – ${dateLabel(p.end, lang)} (${p.days} sessions): when they buy and what followed.`,
        })}
      </p>

      {p.pump_days.length > 0 && (
        <p className="mt-4 flex gap-2 rounded-lg bg-warn/10 px-3 py-2.5 text-[13px] leading-relaxed text-ink-2 ring-1 ring-warn/30">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warn" />
          {tx({
            id: `Pola mirip "pompom" terdeteksi pada ${p.pump_days.map((d) => dateLabel(d, "id")).join(", ")}: harga naik lebih dari 3% dengan volume lebih dari 2× biasanya, sementara broker ritel membeli dan institusi menjual.`,
            en: `A pump-like pattern on ${p.pump_days.map((d) => dateLabel(d, "en")).join(", ")}: price up over 3% on more than 2× normal volume while retail brokers bought and institutions sold.`,
          })}
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {p.brokers.map((b, i) => {
          const gap = b.avg_buy && last ? last / b.avg_buy - 1 : null;
          return (
            <motion.li key={b.code} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.04, ease: EASE }} className="rounded-xl bg-ground/60 p-3.5 ring-1 ring-line">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <Link href={`/broker/${b.code}/`} className="text-[15px] font-semibold text-ink hover:text-arus">
                  {b.code}
                </Link>
                <span className="min-w-0 truncate text-[12.5px] text-muted">
                  {b.name}
                  {b.cohort && COHORT[b.cohort] ? ` · ${tx(COHORT[b.cohort])}` : ""}
                  {b.foreign ? ` · ${tx({ id: "asing", en: "foreign" })}` : ""}
                </span>
                <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11.5px] ring-1 ${STYLE[b.style].tone}`}>{tx(STYLE[b.style].label)}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px] sm:grid-cols-4">
                <div>
                  <div className="text-muted">{tx({ id: "Bersih", en: "Net" })}</div>
                  <div className={`num ${b.net >= 0 ? "text-up" : "text-down"}`}>
                    {b.net >= 0 ? tx({ id: "beli", en: "bought" }) : tx({ id: "jual", en: "sold" })} {idr(Math.abs(b.net), lang)}
                  </div>
                </div>
                <div>
                  <div className="text-muted">{tx({ id: "Hari beli / jual", en: "Buy / sell days" })}</div>
                  <div className="num text-ink">
                    {b.days_buy} / {b.days_sell}
                  </div>
                </div>
                <div>
                  <div className="text-muted">{tx({ id: "Harga rata-rata beli", en: "Avg buy price" })}</div>
                  <div className="num text-ink">
                    {price(b.avg_buy, lang)}
                    {gap != null && <span className={`ml-1 text-[11.5px] ${gap >= 0 ? "text-up" : "text-down"}`}>({signed(gap * 100, 1, "%")})</span>}
                  </div>
                </div>
                <div>
                  <div className="text-muted">{tx({ id: "3 hari setelah ia beli", en: "3 days after it bought" })}</div>
                  <div className={`num ${b.follow3 == null ? "text-muted" : b.follow3 >= 0 ? "text-up" : "text-down"}`}>
                    {b.follow3 == null ? "–" : `${signed(b.follow3 * 100, 1, "%")} vs ${tx({ id: "saham lain", en: "others" })}`}
                    {b.n_follow > 0 && <span className="ml-1 text-[11px] text-muted">({b.n_follow}×)</span>}
                  </div>
                </div>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                {tx(STYLE[b.style].explain)}
                {b.buy_ret != null &&
                  tx({
                    id: ` Rata-rata di hari belinya harga ${signed(b.buy_ret * 100, 1, "%")}${b.buy_vol ? `, volume ${b.buy_vol.toFixed(1).replace(".", ",")}× biasanya` : ""}.`,
                    en: ` On its buying days the price averaged ${signed(b.buy_ret * 100, 1, "%")}${b.buy_vol ? `, volume ${b.buy_vol.toFixed(1)}× normal` : ""}.`,
                  })}
              </p>
            </motion.li>
          );
        })}
      </ul>
      <p className="mt-4 text-[11.5px] leading-relaxed text-muted">
        <T
          id="Dihitung dari data broker harian Sectors. Periodenya beberapa minggu, jadi ini menggambarkan kebiasaan terbaru, bukan pola yang terbukti. Kolom “3 hari setelah ia beli” dibandingkan dengan saham rata-rata di hari yang sama."
          en="Computed from Sectors' daily broker data. The window is a few weeks, so this describes recent habits, not proven patterns. “3 days after it bought” is relative to the median stock on the same day."
        />
      </p>
    </section>
  );
}

/** Market-wide view: for the busiest brokers, which tracked stocks they're piling into and out of. */
export function BrokerMapView({ map }: { map: BrokerMap }) {
  const { tx, lang } = useLang();
  const busiest = Object.entries(map)
    .filter(([, b]) => b.acc.length || b.dist.length)
    .sort((a, b) => b[1].gross - a[1].gross)
    .slice(0, 12);
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {busiest.map(([code, b]) => (
        <div key={code} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
          <div className="flex items-baseline gap-2">
            <span className="text-[16px] font-semibold text-ink">{code}</span>
            <span className="min-w-0 truncate text-[12px] text-muted">
              {b.name}
              {b.cohort && COHORT[b.cohort] ? ` · ${tx(COHORT[b.cohort])}` : ""}
              {b.foreign ? ` · ${tx({ id: "asing", en: "foreign" })}` : ""}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-[12.5px]">
            {[
              { t: { id: "Mengumpulkan", en: "Accumulating" }, l: b.acc, c: "text-up" },
              { t: { id: "Melepas", en: "Distributing" }, l: b.dist, c: "text-down" },
            ].map((col) => (
              <div key={col.t.en}>
                <div className="mb-1 text-muted">{tx(col.t)}</div>
                <ul className="space-y-0.5">
                  {col.l.length === 0 && <li className="text-muted">–</li>}
                  {col.l.map((x) => (
                    <li key={x.s} className="flex justify-between gap-2">
                      <Link href={`/saham/${x.s}/`} className="font-medium text-ink hover:text-arus">
                        {x.s}
                      </Link>
                      <span className={`num ${col.c}`}>{idr(Math.abs(x.net), lang)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function NewsList({ items, compact = false }: { items: NewsItem[]; compact?: boolean }) {
  const { tx, lang } = useLang();
  if (!items.length) return <p className="text-[14px] text-muted">{tx({ id: "Belum ada berita terbaru untuk saham ini.", en: "No recent news for this stock yet." })}</p>;
  return (
    <ul className="space-y-3">
      {items.map((n) => (
        <li key={n.url} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
          <div className="flex items-center gap-2 text-[11.5px] text-muted">
            <span>{dateLabel(n.ts.slice(0, 10), lang)}</span>
            {n.symbols.slice(0, 5).map((s) => (
              <Link key={s} href={`/saham/${s}/`} className="rounded bg-raised px-1.5 py-0.5 font-medium text-ink-2 hover:text-arus">
                {s}
              </Link>
            ))}
          </div>
          <a href={n.url} target="_blank" rel="noreferrer" className="group mt-1.5 block">
            <span className="text-[14.5px] font-semibold leading-snug text-ink group-hover:text-arus">
              {n.title} <ExternalLink size={12} className="inline align-baseline text-muted" />
            </span>
          </a>
          {!compact && <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-ink-2">{n.body}</p>}
          {n.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {n.tags.slice(0, 3).map((t) => (
                <span key={t} className="rounded-full px-2 py-0.5 text-[11px] text-muted ring-1 ring-line">
                  {t}
                </span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

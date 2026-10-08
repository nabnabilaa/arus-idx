"use client";

import Link from "next/link";
import { AlertTriangle, Search } from "lucide-react";
import { useState } from "react";
import { dateLabel, idr, price, signed } from "@/lib/format";
import { T, useLang, type Bi } from "@/lib/i18n";
import type { BrokerProfile, NewsItem } from "@/lib/types";

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

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-right text-[12px] text-muted">
              <th className="py-2 pr-3 text-left font-normal">Broker</th>
              <th className="py-2 pr-3 text-left font-normal">{tx({ id: "Gaya", en: "Style" })}</th>
              <th className="py-2 pr-3 font-normal">{tx({ id: "Bersih", en: "Net" })}</th>
              <th className="py-2 pr-3 font-normal">{tx({ id: "Hari beli / jual", en: "Buy / sell days" })}</th>
              <th className="py-2 pr-3 font-normal">{tx({ id: "Rata-rata beli", en: "Avg buy" })}</th>
              <th className="py-2 pr-3 font-normal">{tx({ id: "Harga di hari belinya", en: "Price on its buy days" })}</th>
              <th className="py-2 font-normal">{tx({ id: "3 hari sesudahnya", en: "3 days later" })}</th>
            </tr>
          </thead>
          <tbody>
            {p.brokers.map((b) => {
              const gap = b.avg_buy && last ? last / b.avg_buy - 1 : null;
              return (
                <tr key={b.code} className="num text-right hover:bg-raised/30">
                  <td className="border-t border-line py-2 pr-3 text-left">
                    <Link href={`/broker/${b.code}/`} className="font-semibold text-ink hover:text-arus">
                      {b.code}
                    </Link>
                    <span className="ml-2 text-[12px] text-muted">
                      {b.cohort && COHORT[b.cohort] ? tx(COHORT[b.cohort]) : ""}
                      {b.foreign ? ` · ${tx({ id: "asing", en: "foreign" })}` : ""}
                    </span>
                  </td>
                  <td className="border-t border-line py-2 pr-3 text-left">
                    <span title={tx(STYLE[b.style].explain)} className={`cursor-help rounded-full px-2 py-0.5 text-[12px] ring-1 ${STYLE[b.style].tone}`}>
                      {tx(STYLE[b.style].label)}
                    </span>
                  </td>
                  <td className={`border-t border-line py-2 pr-3 ${b.net >= 0 ? "text-up" : "text-down"}`}>{idr(b.net, lang)}</td>
                  <td className="border-t border-line py-2 pr-3 text-ink-2">
                    {b.days_buy} / {b.days_sell}
                  </td>
                  <td className="border-t border-line py-2 pr-3 text-ink-2">
                    {price(b.avg_buy, lang)}
                    {gap != null && <span className={`ml-1 text-[12px] ${gap >= 0 ? "text-up" : "text-down"}`}>({signed(gap * 100, 1, "%")})</span>}
                  </td>
                  <td className="border-t border-line py-2 pr-3 text-ink-2">
                    {b.buy_ret != null ? signed(b.buy_ret * 100, 1, "%") : "–"}
                    {b.buy_vol != null && <span className="ml-1 text-[12px] text-muted">vol {b.buy_vol.toFixed(1)}×</span>}
                  </td>
                  <td className={`border-t border-line py-2 ${b.follow3 == null ? "text-muted" : b.follow3 >= 0 ? "text-up" : "text-down"}`}>
                    {b.follow3 == null ? "–" : signed(b.follow3 * 100, 1, "%")}
                    {b.n_follow > 0 && <span className="ml-1 text-[12px] text-muted">({b.n_follow}×)</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[12px] leading-relaxed text-muted">
        <T
          id="Arahkan kursor ke label gaya untuk penjelasannya. “Harga di hari belinya” = rata-rata gerak harga pada hari broker itu membeli bersih. “3 hari sesudahnya” dibandingkan dengan saham rata-rata. Periodenya beberapa minggu, jadi ini kebiasaan terbaru, bukan pola yang terbukti."
          en="Hover a style label for its meaning. “Price on its buy days” = the average price move on days the broker net bought. “3 days later” is relative to the median stock. The window is a few weeks, so these are recent habits, not proven patterns."
        />
      </p>
    </section>
  );
}

const TONE_TAG: Record<string, { c: string; l: { id: string; en: string } }> = {
  Bullish: { c: "#7fd4a8", l: { id: "Nada positif", en: "Positive tone" } },
  Neutral: { c: "#75839a", l: { id: "Nada netral", en: "Neutral tone" } },
  Bearish: { c: "#e66767", l: { id: "Nada negatif", en: "Negative tone" } },
};

/** Topics a reader actually filters by, mapped from Sectors' news tags. */
const TOPICS: { k: string; l: { id: string; en: string }; tags: string[] }[] = [
  { k: "div", l: { id: "Dividen", en: "Dividends" }, tags: ["Dividend Announcement"] },
  { k: "own", l: { id: "Kepemilikan & orang dalam", en: "Ownership & insiders" }, tags: ["Ownership", "Insider Trading", "Institutional Investor"] },
  { k: "deal", l: { id: "Merger & akuisisi", en: "M&A" }, tags: ["Mergers & Acquisitions", "Partnerships & Agreements", "MoU"] },
  { k: "fund", l: { id: "Pendanaan & utang", en: "Funding & debt" }, tags: ["Capital & Funding", "Debt Issuance", "Bonds", "Rights Issue"] },
  { k: "buy", l: { id: "Buyback", en: "Buybacks" }, tags: ["Stock Buyback"] },
  { k: "an", l: { id: "Analis & kinerja", en: "Analysts & results" }, tags: ["Analyst Ratings", "Financial Metrics", "Undervalued"] },
  { k: "for", l: { id: "Asing", en: "Foreign money" }, tags: ["Foreign Investment"] },
];

function NewsItemRow({ n }: { n: NewsItem }) {
  const { tx, lang } = useLang();
  const [open, setOpen] = useState(false);
  let host = "";
  try {
    host = new URL(n.url).hostname.replace(/^www\./, "");
  } catch {}
  const tone = n.tags.map((t) => TONE_TAG[t]).find(Boolean);
  return (
    <li className="py-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: tone?.c ?? "#3a465a" }} title={tone ? tx(tone.l) : undefined} />
        <div className="min-w-0 flex-1">
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="block cursor-pointer text-left">
            <span className="text-[14.5px] font-medium leading-snug text-ink hover:text-arus">{n.title}</span>
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
            <span className="num">{dateLabel(n.ts.slice(0, 10), lang, { year: undefined })}</span>
            {host && <span>· {host}</span>}
            {n.symbols.slice(0, 5).map((sym) => (
              <Link key={sym} href={`/saham/${sym}/`} className="rounded bg-raised px-1.5 py-px text-[12px] font-medium text-ink-2 ring-1 ring-line hover:text-arus">
                {sym}
              </Link>
            ))}
          </div>
          {open && (
            <div className="mt-2 rounded-lg bg-ground/60 p-3 ring-1 ring-line">
              {n.body && <p className="text-[13.5px] leading-relaxed text-ink-2">{n.body}</p>}
              <a href={n.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[12.5px] text-arus hover:underline">
                {tx({ id: "Baca di sumber aslinya →", en: "Read at the source →" })}
              </a>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/** Headlines first: a tone dot, source and stocks; the summary opens on click. Topic chips narrow the feed. */
export function NewsList({ items, searchable = false }: { items: NewsItem[]; searchable?: boolean }) {
  const { tx } = useLang();
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  if (!items.length) return <p className="text-[14px] text-muted">{tx({ id: "Belum ada berita terbaru untuk saham ini.", en: "No recent news for this stock yet." })}</p>;
  const t = q.trim().toLowerCase();
  const tp = TOPICS.find((x) => x.k === topic);
  const shown = items.filter(
    (n) =>
      (!tp || n.tags.some((g) => tp.tags.includes(g))) &&
      (!t || n.title.toLowerCase().includes(t) || (n.body ?? "").toLowerCase().includes(t) || n.symbols.some((s) => s.toLowerCase() === t)),
  );
  const topics = TOPICS.filter((x) => items.some((n) => n.tags.some((g) => x.tags.includes(g))));
  const half = Math.ceil(shown.length / 2);
  return (
    <div>
      {searchable && (
        <div className="mb-2 flex flex-col gap-3">
          <label className="flex h-10 max-w-md items-center gap-2 rounded-lg bg-surface px-3 ring-1 ring-line focus-within:ring-arus/60">
            <Search size={15} className="text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx({ id: "Cari judul atau kode saham (mis. BBCA)", en: "Search a headline or ticker (e.g. BBCA)" })} className="w-full bg-transparent text-[13.5px] text-ink placeholder:text-muted focus:outline-none" />
          </label>
          {topics.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {[{ k: null as string | null, l: { id: "Semua", en: "All" } }, ...topics].map((x) => (
                <button
                  key={x.k ?? "all"}
                  onClick={() => setTopic(x.k)}
                  className={`cursor-pointer rounded-full px-3 py-1 text-[12.5px] ring-1 transition-colors duration-150 ${topic === x.k ? "bg-arus/15 text-arus ring-arus/40" : "text-ink-2 ring-line hover:text-ink"}`}
                >
                  {tx(x.l)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="grid gap-x-10 md:grid-cols-2">
        {[shown.slice(0, half), shown.slice(half)].map((col, c) => (
          <ul key={c} className="divide-y divide-line">
            {col.map((n) => (
              <NewsItemRow key={n.url} n={n} />
            ))}
          </ul>
        ))}
      </div>
      {shown.length === 0 && <p className="py-8 text-[14px] text-muted">{tx({ id: "Tidak ada berita yang cocok.", en: "No articles match." })}</p>}
      <p className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-muted">
        {Object.values(TONE_TAG).map((v) => (
          <span key={v.c} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: v.c }} />
            {tx(v.l)}
          </span>
        ))}
        <span>· {tx({ id: "klik judul untuk ringkasannya", en: "click a headline for its summary" })}</span>
      </p>
    </div>
  );
}

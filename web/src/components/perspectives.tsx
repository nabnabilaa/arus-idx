"use client";

import { motion } from "motion/react";
import { CalendarRange, Landmark, Zap } from "lucide-react";
import type { Cone } from "@/components/charts/candles";
import { pct, price, signed } from "@/lib/format";
import { useLang, type Bi } from "@/lib/i18n";
import type { Candles, FinHealth, Stock } from "@/lib/types";
import { get, VERDICT, verdictOf } from "@/lib/verdict";

const EASE = [0.23, 1, 0.32, 1] as const;

export const FIN_GRADE: Record<"strong" | "fair" | "weak", { label: Bi; tone: string; ring: string }> = {
  strong: { label: { id: "Sehat", en: "Healthy" }, tone: "text-[#7fd4a8]", ring: "bg-aqua/10 ring-aqua/30" },
  fair: { label: { id: "Cukup", en: "Fair" }, tone: "text-ink", ring: "bg-raised ring-line-strong" },
  weak: { label: { id: "Lemah", en: "Weak" }, tone: "text-[#f0a3a3]", ring: "bg-down/10 ring-down/30" },
};

/** Plain words for the next-day score: what 51/100 means without statistics vocabulary. */
export function scoreWords(q: number): Bi {
  const v = verdictOf(q);
  return v === "strong"
    ? { id: "Termasuk 10% saham dengan peluang terbaik untuk besok.", en: "Among the 10% of stocks with the best odds for tomorrow." }
    : v === "edge"
      ? { id: "Peluangnya sedikit di atas kebanyakan saham lain.", en: "Odds slightly above most other stocks." }
      : v === "neutral"
        ? { id: "Tidak lebih baik atau lebih buruk dari saham lain pada umumnya.", en: "No better or worse than a typical stock." }
        : v === "weak"
          ? { id: "Peluangnya sedikit di bawah kebanyakan saham lain.", en: "Odds slightly below most other stocks." }
          : { id: "Termasuk 10% saham yang paling sering tertinggal keesokan harinya.", en: "Among the 10% of stocks that most often lag the next day." };
}

function sma(xs: number[], n: number) {
  if (xs.length < n) return null;
  return xs.slice(-n).reduce((a, b) => a + b, 0) / n;
}

function Card({ i, icon, who, when, children }: { i: number; icon: React.ReactNode; who: string; when: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 + i * 0.06, ease: EASE }}
      className="flex flex-col rounded-2xl bg-surface p-5 ring-1 ring-line"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-arus/12 text-arus">{icon}</span>
        <div className="leading-tight">
          <div className="text-[13.5px] font-semibold text-ink">{who}</div>
          <div className="text-[12px] text-muted">{when}</div>
        </div>
      </div>
      <div className="mt-4 flex flex-1 flex-col">{children}</div>
    </motion.section>
  );
}

/** One stock, three holding periods: the next session, a few weeks, and years. */
export function Perspectives({ s, candles, cone, fin, total }: { s: Stock; candles: Candles | null; cone: Record<1 | 20, Cone> | null; fin: FinHealth | null; total: number }) {
  const { tx, lang } = useLang();
  const g = get(s, 1);
  const v = verdictOf(g.q);
  const score = Math.round(g.conf * 100);
  const rank = Math.min(total, Math.max(1, Math.round((1 - g.q) * total) + 1));

  const week = cone?.[1]?.at(-1);
  const month = cone?.[20]?.at(-1);
  const closes = candles?.c ?? [];
  const ma50 = sma(closes, 50);
  const last = closes.at(-1) ?? s.price ?? 0;
  const trendUp = ma50 != null ? last >= ma50 : null;
  const ff = s.ff_net_20 ?? 0;

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-3">
      <Card i={0} icon={<Zap size={17} />} who={tx({ id: "Trader harian", en: "Day trader" })} when={tx({ id: "untuk besok", en: "for tomorrow" })}>
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] text-muted">#</span>
          <span className="num -ml-1.5 text-4xl font-semibold tracking-tight" style={{ color: VERDICT[v].color }}>
            {rank}
          </span>
          <span className="text-[13px] text-muted">{tx({ id: `dari ${total}`, en: `of ${total}` })}</span>
          <span className="ml-auto rounded-full px-2.5 py-0.5 text-[12px] font-medium ring-1" style={{ color: VERDICT[v].color, borderColor: VERDICT[v].color }}>
            {tx(VERDICT[v].label)}
          </span>
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">{tx(scoreWords(g.q))}</p>
        <p className="mt-auto pt-3 text-[12px] leading-relaxed text-muted">
          {tx({
            id: `Peringkat peluang untuk besok di antara ${total} saham. Secara historis, kondisi seperti ini mengalahkan separuh saham lain ${score} dari 100 kali; perbedaan antarsaham memang tipis, jadi lihat peringkatnya, bukan angkanya saja.`,
            en: `Next-day odds rank among ${total} stocks. Historically this setup beat half of all others ${score} times in 100; differences between stocks are slim, so read the rank, not just the number.`,
          })}
        </p>
      </Card>

      <Card i={1} icon={<CalendarRange size={17} />} who={tx({ id: "Swing", en: "Swing" })} when={tx({ id: "ditahan 1–4 minggu", en: "held 1–4 weeks" })}>
        <dl className="space-y-3">
          {[
            { k: { id: "Rentang wajar 1 minggu", en: "Typical range, 1 week" }, c: week },
            { k: { id: "Rentang wajar 1 bulan", en: "Typical range, 1 month" }, c: month },
          ].map((r) =>
            r.c ? (
              <div key={r.k.en}>
                <dt className="text-[12px] text-muted">{tx(r.k)}</dt>
                <dd className="num mt-0.5 text-[17px] font-semibold text-ink">
                  {price(r.c.lo, lang)} – {price(r.c.hi, lang)}
                  <span className="ml-2 text-[12px] font-normal text-muted">
                    {signed((r.c.lo / last - 1) * 100, 0, "%")} / {signed((r.c.hi / last - 1) * 100, 0, "%")}
                  </span>
                </dd>
              </div>
            ) : null,
          )}
        </dl>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[12px]">
          {trendUp != null && (
            <span className={`rounded-full px-2.5 py-0.5 ring-1 ${trendUp ? "bg-up/10 text-[#9cc5f5] ring-up/30" : "bg-down/10 text-[#f0a3a3] ring-down/30"}`}>
              {trendUp ? tx({ id: "Di atas rata-rata 50 hari", en: "Above 50-day average" }) : tx({ id: "Di bawah rata-rata 50 hari", en: "Below 50-day average" })}
            </span>
          )}
          <span className={`rounded-full px-2.5 py-0.5 ring-1 ${ff >= 0 ? "bg-up/10 text-[#9cc5f5] ring-up/30" : "bg-down/10 text-[#f0a3a3] ring-down/30"}`}>
            {ff >= 0 ? tx({ id: "Asing membeli sebulan", en: "Foreigners bought, 1 mo" }) : tx({ id: "Asing menjual sebulan", en: "Foreigners sold, 1 mo" })}
          </span>
        </div>
        <p className="mt-auto pt-3 text-[12px] leading-relaxed text-muted">
          {tx({
            id: "8 dari 10 kali, harga berakhir di dalam rentang ini (sudah diuji ke data lalu). Rentang ini tidak menebak arah naik atau turun.",
            en: "8 times in 10 the price ended inside this range (tested on past data). It doesn't call a direction.",
          })}
        </p>
      </Card>

      <Card i={2} icon={<Landmark size={17} />} who={tx({ id: "Investor", en: "Investor" })} when={tx({ id: "jangka panjang", en: "long term" })}>
        {fin ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-semibold tracking-tight ${FIN_GRADE[fin.grade].tone}`}>{tx(FIN_GRADE[fin.grade].label)}</span>
              <span className="num text-[13px] text-muted">
                {fin.score}/{fin.n} {tx({ id: "pemeriksaan lolos", en: "checks passed" })}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
              <div>
                <dt className="text-muted">{tx({ id: "Pendapatan per tahun", en: "Revenue growth / yr" })}</dt>
                <dd className={`num text-[15px] ${(fin.rev_cagr ?? 0) >= 0 ? "text-ink" : "text-[#f0a3a3]"}`}>{fin.rev_cagr != null ? signed(fin.rev_cagr * 100, 1, "%") : "–"}</dd>
              </div>
              <div>
                <dt className="text-muted">{tx({ id: "Tahun untung", en: "Profitable years" })}</dt>
                <dd className="num text-[15px] text-ink">
                  {fin.profitable_years}/{fin.years.length}
                </dd>
              </div>
              <div>
                <dt className="text-muted">{tx({ id: "Valuasi vs sektor", en: "Valuation vs sector" })}</dt>
                <dd className="text-[14px] text-ink">
                  {s.pct_value == null ? "–" : s.pct_value >= 0.67 ? tx({ id: "Relatif murah", en: "Relatively cheap" }) : s.pct_value <= 0.33 ? tx({ id: "Relatif mahal", en: "Relatively pricey" }) : tx({ id: "Wajar", en: "In line" })}
                </dd>
              </div>
              <div>
                <dt className="text-muted">{tx({ id: "Dividen", en: "Dividend yield" })}</dt>
                <dd className="num text-[15px] text-ink">{pct(s.yield_ttm, 1)}</dd>
              </div>
            </dl>
            <p className="mt-auto pt-3 text-[12px] leading-relaxed text-muted">
              {tx({
                id: `Dari laporan keuangan tahunan ${fin.prev} dan ${fin.year}. Rinciannya di tab Keuangan.`,
                en: `From the ${fin.prev} and ${fin.year} annual reports. Details in the Financials tab.`,
              })}
            </p>
          </>
        ) : (
          <p className="text-[13.5px] leading-relaxed text-ink-2">
            {tx({
              id: "Laporan keuangan tahunan belum tersedia untuk saham ini. Lihat valuasi dan dividen di tab Keuangan.",
              en: "Annual statements aren't available for this stock yet. See valuation and dividends in the Financials tab.",
            })}
          </p>
        )}
      </Card>
    </div>
  );
}

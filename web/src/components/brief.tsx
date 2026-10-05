"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { SUBSECTOR_ID } from "@/lib/features";
import { dateLabel, idr } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import type { Bundle, Stock } from "@/lib/types";

/** Three sentences on what matters today, written from the day's numbers. */
export function MarketBrief({ ranking, market, sectors, asOf }: { ranking: Stock[]; market: Bundle["market"]; sectors: Bundle["sectors"]; asOf: string }) {
  const { tx, lang } = useLang();
  const ih = market.filter((m) => m.ihsg != null);
  const last = ih.at(-1)?.ihsg ?? 0;
  const ch1 = ih.length > 1 ? last / (ih.at(-2)!.ihsg as number) - 1 : 0;
  const ch20 = ih.length > 21 ? last / (ih.at(-21)!.ihsg as number) - 1 : 0;
  const ff5 = market.slice(-5).reduce((a, m) => a + (m.foreign_net ?? 0), 0);
  const up = ranking.filter((s) => (s.ret_1 ?? 0) > 0).length;
  const down = ranking.filter((s) => (s.ret_1 ?? 0) < 0).length;
  const lead = [...sectors].filter((s) => s.rs_20 != null && s.n >= 3).sort((a, b) => (b.rs_20 ?? 0) - (a.rs_20 ?? 0))[0];
  const lag = [...sectors].filter((s) => s.rs_20 != null && s.n >= 3).sort((a, b) => (a.rs_20 ?? 0) - (b.rs_20 ?? 0))[0];
  const unusual = ranking.filter((s) => Math.max(Math.abs(s.z_foreign ?? 0), Math.abs(s.z_volume ?? 0), Math.abs(s.z_return ?? 0)) >= 3);
  const bigBuy = [...ranking].filter((s) => (s.z_foreign ?? 0) >= 3).sort((a, b) => (b.ff_today ?? 0) - (a.ff_today ?? 0))[0];
  const name = (k: string) => (lang === "id" ? SUBSECTOR_ID[k] ?? k : k);
  const p = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1).replace(".", lang === "id" ? "," : ".")}%`;

  const lines = [
    tx({
      id: `IHSG ${ch1 >= 0 ? "naik" : "turun"} ${p(ch1)} ke ${last.toLocaleString("id-ID", { maximumFractionDigits: 0 })} (${p(ch20)} sebulan); ${up} saham naik dan ${down} turun dari ${ranking.length} yang dipantau.`,
      en: `IHSG ${ch1 >= 0 ? "rose" : "fell"} ${p(ch1)} to ${last.toLocaleString("en-US", { maximumFractionDigits: 0 })} (${p(ch20)} over a month); ${up} stocks rose and ${down} fell of the ${ranking.length} tracked.`,
    }),
    tx({
      id: `Asing ${ff5 >= 0 ? "membeli" : "menjual"} bersih ${idr(Math.abs(ff5), "id")} dalam 5 hari terakhir.${lead ? ` Sektor terkuat sebulan ini ${name(lead.sub_sector)}${lag ? `, terlemah ${name(lag.sub_sector)}` : ""}.` : ""}`,
      en: `Foreigners net ${ff5 >= 0 ? "bought" : "sold"} ${idr(Math.abs(ff5), "en")} over the last 5 days.${lead ? ` Strongest sector this month: ${name(lead.sub_sector)}${lag ? `; weakest: ${name(lag.sub_sector)}` : ""}.` : ""}`,
    }),
    tx({
      id: `${unusual.length} saham bergerak jauh dari kebiasaannya hari ini${bigBuy ? `, termasuk ${bigBuy.symbol} yang diborong asing` : ""}.`,
      en: `${unusual.length} stocks moved far from their habits today${bigBuy ? `, including ${bigBuy.symbol}, heavily bought by foreigners` : ""}.`,
    }),
  ];

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }} className="mb-12 rounded-2xl bg-surface p-5 ring-1 ring-line sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{tx({ id: "Ringkasan pasar", en: "Market brief" })}</h2>
        <span className="text-[12px] text-muted">
          {tx({ id: "Data penutupan", en: "Close of" })} {dateLabel(asOf, lang, { weekday: "long" })}
        </span>
      </div>
      <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-ink-2">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-arus" />
            {l}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2 text-[12.5px]">
        <Link href="/anomali/" className="rounded-full px-3 py-1 text-arus ring-1 ring-arus/40 hover:bg-arus/10">
          {tx({ id: "Lihat yang tak biasa", en: "See unusual activity" })}
        </Link>
        <Link href="/sektor/" className="rounded-full px-3 py-1 text-ink-2 ring-1 ring-line hover:text-ink">
          {tx({ id: "Peta sektor", en: "Sector map" })}
        </Link>
        <Link href="/asing/" className="rounded-full px-3 py-1 text-ink-2 ring-1 ring-line hover:text-ink">
          {tx({ id: "Arus asing & bandar", en: "Foreign & brokers" })}
        </Link>
      </div>
    </motion.section>
  );
}

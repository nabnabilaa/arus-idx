"use client";

import Link from "next/link";
import { useState } from "react";
import { Segmented } from "@/components/ui";
import { dateLabel, idr, price } from "@/lib/format";
import { T, useLang, type Bi } from "@/lib/i18n";
import type { BrokerSummary } from "@/lib/types";

type Period = "1" | "5" | "all";

const COHORT: Record<string, Bi> = {
  institutional: { id: "Institusi", en: "Institutional" },
  retail: { id: "Ritel", en: "Retail" },
  mixed: { id: "Campuran", en: "Mixed" },
};

export function cohortDot(cohort: string | null, foreign: boolean) {
  const c = foreign ? "#1baf7a" : cohort === "retail" ? "#eb6834" : cohort === "institutional" ? "#3987e5" : "#75839a";
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: c }} />;
}

/** The broker-summary view: who bought and who sold, how many lots, at what average price. */
export function BrokerSummaryView({ data, last, compact = false }: { data: Record<Period, BrokerSummary>; last: number | null; compact?: boolean }) {
  const { tx, lang } = useLang();
  const [p, setP] = useState<Period>("5");
  const d = data[p];
  const tilt = d.top5_buy + d.top5_sell > 0 ? (d.top5_buy - d.top5_sell) / (d.top5_buy + d.top5_sell) : 0;
  const verdict: { l: Bi; c: string } =
    tilt > 0.15
      ? { l: { id: "Akumulasi", en: "Accumulation" }, c: "text-up" }
      : tilt < -0.15
        ? { l: { id: "Distribusi", en: "Distribution" }, c: "text-down" }
        : { l: { id: "Seimbang", en: "Balanced" }, c: "text-ink" };
  const n = compact ? 5 : 10;
  const max = Math.max(...d.buyers.slice(0, n).map((r) => Math.abs(r.net)), ...d.sellers.slice(0, n).map((r) => Math.abs(r.net)), 1);

  const table = (rows: BrokerSummary["buyers"], buy: boolean) => (
    <table className="w-full border-separate border-spacing-0 text-[12.5px]">
      <thead>
        <tr className="text-right text-[12px] text-muted">
          <th className="py-1.5 text-left font-normal">{buy ? tx({ id: "Pembeli", en: "Buyer" }) : tx({ id: "Penjual", en: "Seller" })}</th>
          <th className="py-1.5 font-normal">{tx({ id: "Nilai", en: "Value" })}</th>
          <th className="hidden py-1.5 font-normal sm:table-cell">Lot</th>
          <th className="py-1.5 font-normal">{tx({ id: "Rata-rata", en: "Avg" })}</th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, n).map((r) => (
          <tr key={r.code} className="num text-right">
            <td className="relative border-t border-line py-1.5 text-left">
              <span className={`absolute inset-y-1 left-0 rounded-sm ${buy ? "bg-up/15" : "bg-down/15"}`} style={{ width: `${(Math.abs(r.net) / max) * 100}%` }} />
              <Link href={`/broker/${r.code}/`} className="relative inline-flex items-center gap-1.5 font-semibold text-ink hover:text-arus">
                {cohortDot(r.cohort, r.foreign)}
                {r.code}
              </Link>
            </td>
            <td className={`border-t border-line py-1.5 ${buy ? "text-up" : "text-down"}`}>{idr(Math.abs(r.net), lang)}</td>
            <td className="hidden border-t border-line py-1.5 text-ink-2 sm:table-cell">{Math.abs(r.nlot).toLocaleString(lang === "id" ? "id-ID" : "en-US", { maximumFractionDigits: 0 })}</td>
            <td className="border-t border-line py-1.5 text-ink-2">{price(r.avg, lang)}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={4} className="border-t border-line py-3 text-center text-muted">
              –
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const bandarAvg = (() => {
    const top = d.buyers.slice(0, 3).filter((r) => r.avg);
    const w = top.reduce((a, r) => a + r.net, 0);
    return w ? top.reduce((a, r) => a + (r.avg as number) * r.net, 0) / w : null;
  })();
  const gap = bandarAvg && last ? last / bandarAvg - 1 : null;

  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-semibold">
            <T id="Ringkasan broker" en="Broker summary" />
          </h3>
          <p className="text-[12px] text-muted">
            {dateLabel(d.from, lang)}
            {d.n > 1 ? ` – ${dateLabel(d.to, lang)}` : ""} · {tx({ id: `${d.n} hari bursa`, en: `${d.n} sessions` })}
          </p>
        </div>
        <Segmented<Period>
          label={tx({ id: "Periode", en: "Period" })}
          value={p}
          onChange={setP}
          options={[
            { value: "1", label: tx({ id: "1 hari", en: "1D" }) },
            { value: "5", label: tx({ id: "5 hari", en: "5D" }) },
            { value: "all", label: tx({ id: "Semua", en: "All" }) },
          ]}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-ground/60 p-2.5 ring-1 ring-line">
          <div className="text-[12px] text-muted">{tx({ id: "Arah 5 broker teratas", en: "Top-5 broker tilt" })}</div>
          <div className={`text-[16px] font-semibold ${verdict.c}`}>{tx(verdict.l)}</div>
        </div>
        <div className="rounded-lg bg-ground/60 p-2.5 ring-1 ring-line">
          <div className="text-[12px] text-muted">{tx({ id: "Beli vs jual (top 5)", en: "Buy vs sell (top 5)" })}</div>
          <div className="num text-[14px] text-ink">
            <span className="text-up">{idr(d.top5_buy, lang)}</span> / <span className="text-down">{idr(d.top5_sell, lang)}</span>
          </div>
        </div>
        <div className="rounded-lg bg-ground/60 p-2.5 ring-1 ring-line">
          <div className="text-[12px] text-muted">{tx({ id: "Rata-rata 3 pembeli utama", en: "Top-3 buyers' avg" })}</div>
          <div className="num text-[15px] text-ink">
            {price(bandarAvg, lang)}
            {gap != null && <span className={`ml-1 text-[12px] ${gap >= 0 ? "text-up" : "text-down"}`}>({gap >= 0 ? "+" : ""}{(gap * 100).toFixed(1)}%)</span>}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        {table(d.buyers, true)}
        {table(d.sellers, false)}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5">{cohortDot("institutional", false)} {tx(COHORT.institutional)}</span>
        <span className="inline-flex items-center gap-1.5">{cohortDot("retail", false)} {tx(COHORT.retail)}</span>
        <span className="inline-flex items-center gap-1.5">{cohortDot(null, true)} {tx({ id: "Asing", en: "Foreign" })}</span>
        <span className="inline-flex items-center gap-1.5">{cohortDot("mixed", false)} {tx(COHORT.mixed)}</span>
        <span>· {tx({ id: "Klik kode broker untuk melihat di saham mana saja ia aktif.", en: "Click a broker code to see where else it trades." })}</span>
      </div>
    </section>
  );
}

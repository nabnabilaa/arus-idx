"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import { signed } from "@/lib/format";
import { T, useLang, type Bi } from "@/lib/i18n";
import type { Bundle, Candles, MacroKey, Stock } from "@/lib/types";

const EASE = [0.23, 1, 0.32, 1] as const;

/** Each global factor: how to name it, how one unit of it is measured, and why it reaches IDX stocks. */
export const MACRO_INFO: Record<MacroKey, { name: Bi; unit: Bi; scale: number; level: boolean; up: Bi; down: Bi; why: Bi }> = {
  idr: {
    name: { id: "Rupiah (USD/IDR)", en: "Rupiah (USD/IDR)" }, unit: { id: "rupiah melemah 1%", en: "rupiah weakens 1%" }, scale: 0.01, level: false,
    up: { id: "melemah", en: "weakened" }, down: { id: "menguat", en: "strengthened" },
    why: { id: "Rupiah lemah membantu eksportir (batu bara, sawit), tapi membebani importir dan perusahaan berutang dolar.", en: "A weak rupiah helps exporters (coal, palm oil) but hurts importers and dollar borrowers." },
  },
  oil: {
    name: { id: "Minyak Brent", en: "Brent oil" }, unit: { id: "minyak naik 1%", en: "oil rises 1%" }, scale: 0.01, level: false,
    up: { id: "naik", en: "rose" }, down: { id: "turun", en: "fell" },
    why: { id: "Menggerakkan saham energi dan tambang; bagi maskapai, kimia, dan konsumen justru jadi beban biaya.", en: "Moves energy and mining stocks; a cost burden for airlines, chemicals and consumers." },
  },
  spx: {
    name: { id: "Saham AS (S&P 500)", en: "US stocks (S&P 500)" }, unit: { id: "S&P 500 naik 1%", en: "S&P 500 rises 1%" }, scale: 0.01, level: false,
    up: { id: "naik", en: "rose" }, down: { id: "turun", en: "fell" },
    why: { id: "Cermin selera risiko investor global; saat Wall Street naik, dana asing lebih berani masuk ke pasar berkembang.", en: "A gauge of global risk appetite; when Wall Street rises, foreign money is bolder about emerging markets." },
  },
  vix: {
    name: { id: "Rasa takut global (VIX)", en: "Global fear (VIX)" }, unit: { id: "VIX naik 1 poin", en: "VIX rises 1 point" }, scale: 1, level: true,
    up: { id: "naik", en: "rose" }, down: { id: "turun", en: "fell" },
    why: { id: "Saat VIX melonjak, investor global menjual aset berisiko, termasuk saham Indonesia.", en: "When VIX spikes, global investors sell risky assets, Indonesian stocks included." },
  },
  usd: {
    name: { id: "Dolar AS (indeks)", en: "US dollar index" }, unit: { id: "dolar menguat 1%", en: "dollar strengthens 1%" }, scale: 0.01, level: false,
    up: { id: "menguat", en: "strengthened" }, down: { id: "melemah", en: "weakened" },
    why: { id: "Dolar kuat biasanya menarik dana keluar dari pasar berkembang.", en: "A strong dollar usually pulls money out of emerging markets." },
  },
  us10y: {
    name: { id: "Bunga AS 10 tahun", en: "US 10-year yield" }, unit: { id: "yield naik 0,1 poin", en: "yield rises 0.1 pt" }, scale: 0.1, level: true,
    up: { id: "naik", en: "rose" }, down: { id: "turun", en: "fell" },
    why: { id: "Bunga AS naik membuat obligasi AS lebih menarik, sehingga saham bank dan properti sering tertekan.", en: "Higher US yields make Treasuries more attractive, often weighing on banks and property." },
  },
};
const KEYS: MacroKey[] = ["idr", "oil", "spx", "vix", "usd", "us10y"];

function Spark({ v, color }: { v: number[]; color: string }) {
  if (v.length < 2) return null;
  const lo = Math.min(...v), hi = Math.max(...v);
  const W = 120, H = 34;
  const d = v.map((x, i) => `${i ? "L" : "M"} ${(i / (v.length - 1)) * W} ${H - 2 - ((x - lo) / (hi - lo || 1)) * (H - 4)}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

/** Value of a factor on or before each date (macro markets close on different days than IDX). */
function asOf(dates: string[], series: { date: string[]; v: number[] }) {
  const out: (number | null)[] = [];
  let j = 0;
  let cur: number | null = null;
  for (const d of dates) {
    while (j < series.date.length && series.date[j] <= d) cur = series.v[j++];
    out.push(cur);
  }
  return out;
}

export function GlobalView({ s, candles, macro, ihsg }: { s: Stock; candles: Candles | null; macro: Bundle["macro"]; ihsg: { date: string; v: number | null }[] }) {
  const { tx, lang } = useLang();

  const study = useMemo(() => {
    if (!candles) return null;
    const dates = candles.date;
    const ret = candles.c.map((c, i) => (i && candles.c[i - 1] ? c / candles.c[i - 1] - 1 : null));
    const out: Partial<Record<MacroKey, { up: number | null; down: number | null; nUp: number; nDown: number; cut: number }>> = {};
    for (const k of KEYS) {
      const ser = macro?.series?.[k];
      if (!ser) continue;
      const lv = asOf(dates, ser);
      const ch = lv.map((x, i) => (i && x != null && lv[i - 1] != null ? (MACRO_INFO[k].level ? x - (lv[i - 1] as number) : x / (lv[i - 1] as number) - 1) : null));
      const idx = ch.map((c, i) => ({ c, r: ret[i] })).filter((x) => x.c != null && x.c !== 0 && x.r != null) as { c: number; r: number }[];
      if (idx.length < 40) continue;
      const cut = [...idx].map((x) => Math.abs(x.c)).sort((a, b) => a - b)[Math.floor(idx.length * 0.8)];
      const big = idx.filter((x) => Math.abs(x.c) >= cut);
      const ups = big.filter((x) => x.c > 0), downs = big.filter((x) => x.c < 0);
      const mean = (a: { r: number }[]) => (a.length ? a.reduce((t, x) => t + x.r, 0) / a.length : null);
      out[k] = { up: mean(ups), down: mean(downs), nUp: ups.length, nDown: downs.length, cut };
    }
    // stock vs IHSG, last 60 sessions
    const im = new Map(ihsg.map((p) => [p.date, p.v]));
    const pairs: [number, number][] = [];
    for (let i = Math.max(1, dates.length - 60); i < dates.length; i++) {
      const a = im.get(dates[i]), b = im.get(dates[i - 1]);
      if (a && b && ret[i] != null) pairs.push([a / b - 1, ret[i] as number]);
    }
    const n = pairs.length;
    const mx = pairs.reduce((t, p) => t + p[0], 0) / (n || 1), my = pairs.reduce((t, p) => t + p[1], 0) / (n || 1);
    const cov = pairs.reduce((t, p) => t + (p[0] - mx) * (p[1] - my), 0);
    const vx = pairs.reduce((t, p) => t + (p[0] - mx) ** 2, 0), vy = pairs.reduce((t, p) => t + (p[1] - my) ** 2, 0);
    const downDays = pairs.filter((p) => p[0] <= -0.01);
    return {
      factors: out,
      beta: vx ? cov / vx : null,
      corr: vx && vy ? cov / Math.sqrt(vx * vy) : null,
      ihsgDown: downDays.length ? downDays.reduce((t, p) => t + p[1], 0) / downDays.length : null,
      nDown: downDays.length,
    };
  }, [candles, macro, ihsg]);

  const rows = KEYS.map((k) => {
    const beta = (s as unknown as Record<string, number | null>)[`beta_${k}`];
    return { k, impact: beta != null ? beta * MACRO_INFO[k].scale : null, d20: macro?.recent?.[k]?.d20 ?? null, last: macro?.recent?.[k]?.last ?? null };
  });
  const ranked = rows.filter((r) => r.impact != null).sort((a, b) => Math.abs(b.impact as number) - Math.abs(a.impact as number));
  const top = ranked[0];
  const push = rows.reduce((a, r) => a + (r.impact ?? 0) * ((r.d20 ?? 0) / MACRO_INFO[r.k].scale), 0);
  const moved = (k: MacroKey, d: number) =>
    MACRO_INFO[k].level ? `${Math.abs(d).toFixed(k === "us10y" ? 2 : 1)} ${tx({ id: "poin", en: "pts" })}` : `${Math.abs(d * 100).toFixed(1).replace(".", lang === "id" ? "," : ".")}%`;

  return (
    <div className="space-y-5">
      {/* headline */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-surface p-5 ring-1 ring-line lg:col-span-2">
          <div className="text-[12.5px] text-muted">{tx({ id: `Faktor global yang paling terasa di ${s.symbol}`, en: `The global factor ${s.symbol} feels most` })}</div>
          {top ? (
            <>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-ink">{tx(MACRO_INFO[top.k].name)}</div>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
                {tx({
                  id: `Saat ${MACRO_INFO[top.k].unit.id}, ${s.symbol} rata-rata bergerak ${signed((top.impact as number) * 100, 2, "%")} di hari yang sama (60 hari terakhir). Secara umum: ${MACRO_INFO[top.k].why.id.charAt(0).toLowerCase()}${MACRO_INFO[top.k].why.id.slice(1)} Data saham ini sendiri yang menentukan arahnya.`,
                  en: `When ${MACRO_INFO[top.k].unit.en}, ${s.symbol} moved ${signed((top.impact as number) * 100, 2, "%")} on average the same day (last 60 days). In general: ${MACRO_INFO[top.k].why.en.charAt(0).toLowerCase()}${MACRO_INFO[top.k].why.en.slice(1)} This stock's own data decides the direction.`,
                })}
              </p>
            </>
          ) : (
            <p className="mt-2 text-[14px] text-ink-2">{tx({ id: "Belum cukup data.", en: "Not enough data yet." })}</p>
          )}
        </div>
        <div className={`rounded-2xl p-5 ring-1 ${push >= 0 ? "bg-up/10 ring-up/30" : "bg-down/10 ring-down/30"}`}>
          <div className="text-[12.5px] text-muted">{tx({ id: "Perkiraan dorongan global sebulan terakhir", en: "Estimated global push, last month" })}</div>
          <div className={`num mt-1 text-3xl font-semibold ${push >= 0 ? "text-up" : "text-down"}`}>{signed(push * 100, 1, "%")}</div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            {tx({ id: "Sensitivitas tiap faktor × pergerakannya sebulan. Perkiraan kasar, bukan target harga.", en: "Each factor's sensitivity × its one-month move. A rough estimate, not a price target." })}
          </p>
        </div>
      </section>

      {/* factor cards */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {KEYS.map((k, i) => {
          const r = rows.find((x) => x.k === k)!;
          const st = study?.factors[k];
          const ser = macro?.series?.[k];
          const d = r.d20 ?? 0;
          const color = d >= 0 ? "#5cc8ff" : "#e66767";
          return (
            <motion.div key={k} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.04, ease: EASE }} className="flex flex-col rounded-2xl bg-surface p-4 ring-1 ring-line">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-ink">{tx(MACRO_INFO[k].name)}</div>
                  <div className="num text-[12.5px] text-ink-2">
                    {r.last != null ? r.last.toLocaleString(lang === "id" ? "id-ID" : "en-US", { maximumFractionDigits: 2 }) : "–"}
                    <span className="ml-1.5 text-muted">
                      {tx(d >= 0 ? MACRO_INFO[k].up : MACRO_INFO[k].down)} {moved(k, d)} {tx({ id: "sebulan", en: "in a month" })}
                    </span>
                  </div>
                </div>
                {ser && <Spark v={ser.v.slice(-60)} color={color} />}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded-lg bg-ground/60 p-2.5 ring-1 ring-line">
                  <dt className="text-muted">{tx({ id: `Jika ${MACRO_INFO[k].unit.id}`, en: `If ${MACRO_INFO[k].unit.en}` })}</dt>
                  <dd className={`num mt-0.5 text-[15px] font-semibold ${r.impact == null ? "text-muted" : r.impact >= 0 ? "text-up" : "text-down"}`}>
                    {r.impact == null ? "–" : `${s.symbol} ${signed(r.impact * 100, 2, "%")}`}
                  </dd>
                </div>
                <div className="rounded-lg bg-ground/60 p-2.5 ring-1 ring-line">
                  <dt className="text-muted">{tx({ id: "Hari bergerak tajam", en: "On big-move days" })}</dt>
                  <dd className="num mt-0.5 text-ink-2">
                    <span className={st?.up == null ? "text-muted" : st.up >= 0 ? "text-up" : "text-down"}>{st?.up == null ? "–" : signed(st.up * 100, 1, "%")}</span>
                    <span className="text-muted"> {tx(MACRO_INFO[k].up)}</span>
                  </dd>
                  <dd className="num text-ink-2">
                    <span className={st?.down == null ? "text-muted" : st.down >= 0 ? "text-up" : "text-down"}>{st?.down == null ? "–" : signed(st.down * 100, 1, "%")}</span>
                    <span className="text-muted"> {tx(MACRO_INFO[k].down)}</span>
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-[12px] leading-relaxed text-muted">{tx({ id: "Secara umum: ", en: "In general: " })}{tx(MACRO_INFO[k].why)}</p>
            </motion.div>
          );
        })}
      </section>

      {/* link with IHSG */}
      {study && (
        <section className="grid gap-3 rounded-2xl bg-surface p-5 ring-1 ring-line sm:grid-cols-3">
          <div>
            <div className="text-[12px] text-muted">{tx({ id: "Seberapa searah dengan IHSG", en: "How closely it tracks IHSG" })}</div>
            <div className="num mt-1 text-2xl font-semibold text-ink">{study.corr != null ? study.corr.toFixed(2) : "–"}</div>
            <div className="text-[12px] text-muted">{tx({ id: "1 = selalu searah, 0 = tidak berhubungan", en: "1 = always together, 0 = unrelated" })}</div>
          </div>
          <div>
            <div className="text-[12px] text-muted">{tx({ id: "Saat IHSG bergerak 1%", en: "When IHSG moves 1%" })}</div>
            <div className="num mt-1 text-2xl font-semibold text-ink">{study.beta != null ? `${signed(study.beta, 2)}%` : "–"}</div>
            <div className="text-[12px] text-muted">{tx({ id: "rata-rata gerak saham ini (beta)", en: "this stock's average move (beta)" })}</div>
          </div>
          <div>
            <div className="text-[12px] text-muted">{tx({ id: "Saat IHSG turun lebih dari 1%", en: "When IHSG falls over 1%" })}</div>
            <div className={`num mt-1 text-2xl font-semibold ${study.ihsgDown == null ? "text-muted" : study.ihsgDown >= 0 ? "text-up" : "text-down"}`}>
              {study.ihsgDown == null ? "–" : signed(study.ihsgDown * 100, 1, "%")}
            </div>
            <div className="text-[12px] text-muted">{tx({ id: `rata-rata saham ini (${study.nDown} hari)`, en: `this stock's average (${study.nDown} days)` })}</div>
          </div>
        </section>
      )}

      <p className="text-[12px] leading-relaxed text-muted">
        <T
          id="“Hari bergerak tajam” = 20% hari dengan pergerakan faktor terbesar sepanjang histori Arus. Sumber: FRED (Federal Reserve Bank of St. Louis) dan kurs referensi Bank Sentral Eropa; harga saham dari Sectors."
          en="“Big-move days” = the 20% of days with the largest factor moves over Arus' history. Sources: FRED (Federal Reserve Bank of St. Louis) and European Central Bank reference rates; stock prices from Sectors."
        />
      </p>
    </div>
  );
}

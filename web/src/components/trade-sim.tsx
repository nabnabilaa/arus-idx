"use client";

import { useMemo, useState } from "react";
import { Segmented } from "@/components/ui";
import { dateLabel, price, signed } from "@/lib/format";
import { T, useLang } from "@/lib/i18n";
import type { Candles } from "@/lib/types";

const BUY_FEE = 0.0015;
const SELL_FEE = 0.0025;
const LOT = 100;

/** IDX price fractions (tick sizes) by price band. */
export function tick(p: number) {
  return p < 200 ? 1 : p < 500 ? 2 : p < 2000 ? 5 : p < 5000 ? 10 : 25;
}
const floorTick = (p: number) => Math.floor(p / tick(p)) * tick(p);
const ceilTick = (p: number) => Math.ceil(p / tick(p)) * tick(p);

type Mode = "tight" | "mid" | "wide" | "custom";
const PRESET: Record<Exclude<Mode, "custom">, { sl: number; tp: number; hold: number }> = {
  tight: { sl: 1, tp: 1.5, hold: 1 },
  mid: { sl: 1.5, tp: 3, hold: 5 },
  wide: { sl: 2, tp: 4, hold: 10 },
};

/** 14-day average true range as a fraction of price, per day. */
function atrSeries(c: Candles): (number | null)[] {
  const out: (number | null)[] = [];
  const trs: number[] = [];
  for (let i = 0; i < c.c.length; i++) {
    const h = c.h[i], l = c.l[i], pc = i ? c.c[i - 1] : null;
    if (h == null || l == null) { out.push(null); continue; }
    const tr = pc == null ? h - l : Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    trs.push(tr / c.c[i]);
    out.push(trs.length >= 10 ? trs.slice(-14).reduce((a, b) => a + b, 0) / Math.min(14, trs.length) : null);
  }
  return out;
}

type Outcome = { ret: number; kind: "tp" | "sl" | "time"; days: number };

/** Replay one bracket order from every day of this stock's history: buy next open, stop assumed first when both touch. */
function replay(c: Candles, atr: (number | null)[], rule: (entry: number, i: number) => { sl: number; tp: number } | null, hold: number): Outcome[] {
  const res: Outcome[] = [];
  for (let i = 20; i + 1 < c.c.length; i++) {
    const e = c.o[i + 1];
    if (e == null || !(e > 0) || atr[i] == null) continue;
    const r = rule(e, i);
    if (!r) continue;
    let exit: number | null = null;
    let kind: Outcome["kind"] = "time";
    let j = i + 1;
    for (; j < Math.min(i + 1 + hold, c.c.length); j++) {
      const o = c.o[j] ?? c.c[j], lo = c.l[j] ?? c.c[j], hi = c.h[j] ?? c.c[j];
      if (j > i + 1 && o <= r.sl) { exit = o; kind = "sl"; break; }       // gap through the stop
      if (lo <= r.sl) { exit = r.sl; kind = "sl"; break; }
      if (j > i + 1 && o >= r.tp) { exit = o; kind = "tp"; break; }
      if (hi >= r.tp) { exit = r.tp; kind = "tp"; break; }
    }
    if (exit == null) {
      j = Math.min(i + hold, c.c.length - 1);
      exit = c.c[j];
    }
    if (i + hold >= c.c.length && kind === "time") continue;     // unfinished trade at the end of data
    res.push({ ret: (exit * (1 - SELL_FEE)) / (e * (1 + BUY_FEE)) - 1, kind, days: j - i });
  }
  return res;
}

export function TradeSim({ candles: c }: { candles: Candles }) {
  const { tx, lang } = useLang();
  const n = c.c.length;
  const last = c.c[n - 1];
  const atr = useMemo(() => atrSeries(c), [c]);
  const atrNow = atr[n - 1] ?? 0.02;

  const [mode, setMode] = useState<Mode>("mid");
  const [entryTxt, setEntryTxt] = useState(String(last));
  const [slPct, setSlPct] = useState(3);
  const [tpPct, setTpPct] = useState(6);
  const [holdC, setHoldC] = useState(5);
  const [capTxt, setCapTxt] = useState("10000000");

  const entry = Math.max(1, Number(entryTxt.replace(/[^\d.]/g, "")) || last);
  const cap = Math.max(0, Number(capTxt.replace(/[^\d]/g, "")) || 0);
  const p = mode === "custom" ? null : PRESET[mode];
  const hold = p ? p.hold : holdC;

  const slPrice = floorTick(p ? entry * (1 - p.sl * atrNow) : entry * (1 - slPct / 100));
  const tpPrice = ceilTick(p ? entry * (1 + p.tp * atrNow) : entry * (1 + tpPct / 100));
  const slMove = slPrice / entry - 1;
  const tpMove = tpPrice / entry - 1;

  const outcomes = useMemo(
    () =>
      replay(
        c,
        atr,
        (e, i) =>
          p
            ? { sl: e * (1 - p.sl * (atr[i] as number)), tp: e * (1 + p.tp * (atr[i] as number)) }
            : { sl: e * (1 - slPct / 100), tp: e * (1 + tpPct / 100) },
        hold,
      ),
    [c, atr, p, slPct, tpPct, hold],
  );

  const N = outcomes.length;
  const share = (k: Outcome["kind"]) => (N ? outcomes.filter((o) => o.kind === k).length / N : 0);
  const rets = outcomes.map((o) => o.ret).sort((a, b) => a - b);
  const avg = N ? rets.reduce((a, b) => a + b, 0) / N : 0;
  const med = N ? rets[Math.floor(N / 2)] : 0;
  const gain = rets.filter((r) => r > 0).reduce((a, b) => a + b, 0);
  const loss = -rets.filter((r) => r < 0).reduce((a, b) => a + b, 0);
  const pf = loss > 0 ? gain / loss : null;
  const win = N ? rets.filter((r) => r > 0).length / N : 0;

  const lots = Math.floor(cap / (entry * LOT * (1 + BUY_FEE)));
  const shares = lots * LOT;
  const lossRp = shares * (entry * (1 + BUY_FEE) - slPrice * (1 - SELL_FEE));
  const gainRp = shares * (tpPrice * (1 - SELL_FEE) - entry * (1 + BUY_FEE));
  const rr = lossRp > 0 ? gainRp / lossRp : null;
  const lo1 = floorTick(last * (1 - atrNow));
  const hi1 = ceilTick(last * (1 + atrNow));

  const modeLabel: Record<Mode, { id: string; en: string }> = {
    tight: { id: "Ketat", en: "Tight" },
    mid: { id: "Sedang", en: "Medium" },
    wide: { id: "Longgar", en: "Wide" },
    custom: { id: "Atur sendiri", en: "Custom" },
  };
  const field = "num h-10 w-full rounded-lg bg-ground/60 px-3 text-[14px] text-ink ring-1 ring-line-strong focus:outline-none focus:ring-arus/70";
  const tone = avg > 0 ? "text-up" : "text-down";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* plan */}
      <section className="rounded-2xl bg-surface p-5 ring-1 ring-line">
        <h3 className="text-[16px] font-semibold">
          <T id="Rencana trade" en="Trade plan" />
        </h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {tx({
            id: `Gerak normal harian saham ini ±${(atrNow * 100).toFixed(1)}%. Rentang wajar besok kira-kira Rp${price(lo1, lang)} – Rp${price(hi1, lang)}.`,
            en: `This stock's normal daily move is ±${(atrNow * 100).toFixed(1)}%. A typical range tomorrow is roughly ${price(lo1, lang)} – ${price(hi1, lang)}.`,
          })}
        </p>

        <div className="mt-4">
          <Segmented<Mode> label={tx({ id: "Profil", en: "Profile" })} value={mode} onChange={setMode} options={(["tight", "mid", "wide", "custom"] as Mode[]).map((m) => ({ value: m, label: tx(modeLabel[m]) }))} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-[12px] text-muted">
          <label className="col-span-2 sm:col-span-1">
            <T id="Harga beli" en="Entry price" />
            <input inputMode="numeric" value={entryTxt} onChange={(e) => setEntryTxt(e.target.value)} className={`${field} mt-1`} />
          </label>
          <label className="col-span-2 sm:col-span-1">
            <T id="Modal (Rp)" en="Capital (IDR)" />
            <input inputMode="numeric" value={capTxt} onChange={(e) => setCapTxt(e.target.value)} className={`${field} mt-1`} />
          </label>
          {mode === "custom" && (
            <>
              <label>
                CL (%)
                <input type="number" min={0.5} max={30} step={0.5} value={slPct} onChange={(e) => setSlPct(Math.max(0.5, +e.target.value || 0.5))} className={`${field} mt-1`} />
              </label>
              <label>
                TP (%)
                <input type="number" min={0.5} max={60} step={0.5} value={tpPct} onChange={(e) => setTpPct(Math.max(0.5, +e.target.value || 0.5))} className={`${field} mt-1`} />
              </label>
              <label className="col-span-2">
                <T id="Tahan maksimal (hari bursa)" en="Max holding (sessions)" />
                <input type="number" min={1} max={20} value={holdC} onChange={(e) => setHoldC(Math.min(20, Math.max(1, Math.round(+e.target.value || 1))))} className={`${field} mt-1`} />
              </label>
            </>
          )}
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            { k: { id: "Cut loss", en: "Stop loss" }, v: slPrice, m: slMove, c: "text-down" },
            { k: { id: "Harga beli", en: "Entry" }, v: entry, m: 0, c: "text-ink" },
            { k: { id: "Take profit", en: "Take profit" }, v: tpPrice, m: tpMove, c: "text-up" },
          ].map((x) => (
            <div key={x.k.id} className="rounded-lg bg-ground/60 p-2.5 ring-1 ring-line">
              <dt className="text-[11.5px] text-muted">{tx(x.k)}</dt>
              <dd className={`num mt-0.5 text-[18px] font-semibold ${x.c}`}>{price(x.v, lang)}</dd>
              <dd className="num text-[11.5px] text-muted">{x.m ? signed(x.m * 100, 1, "%") : `${tx({ id: "tahan", en: "hold" })} ≤${hold}h`}</dd>
            </div>
          ))}
        </dl>

        <dl className="mt-4 space-y-1.5 text-[13px]">
          <div className="flex justify-between gap-3">
            <dt className="text-muted"><T id="Bisa beli" en="Can buy" /></dt>
            <dd className="num">{lots.toLocaleString(lang === "id" ? "id-ID" : "en-US")} lot</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted"><T id="Kalau kena CL" en="If stopped out" /></dt>
            <dd className="num text-down">−Rp{price(Math.round(lossRp), lang)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted"><T id="Kalau kena TP" en="If target hit" /></dt>
            <dd className="num text-up">+Rp{price(Math.round(gainRp), lang)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted"><T id="Rasio untung : rugi" en="Reward : risk" /></dt>
            <dd className="num">{rr != null ? `${rr.toFixed(2)} : 1` : "–"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
          <T
            id="Sudah termasuk biaya beli 0,15% dan jual 0,25%. Harga dibulatkan ke fraksi harga BEI."
            en="Includes 0.15% buy and 0.25% sell fees. Prices rounded to IDX tick sizes."
          />
        </p>
      </section>

      {/* history */}
      <section className="rounded-2xl bg-surface p-5 ring-1 ring-line">
        <h3 className="text-[16px] font-semibold">
          <T id="Kalau aturan ini dipakai di masa lalu" en="If this rule had been used before" />
        </h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {tx({
            id: `Aturan yang sama diputar ulang ${N} kali, sekali dari setiap hari bursa saham ini sejak ${dateLabel(c.date[21] ?? c.date[0], lang)}: beli di harga pembukaan esok harinya, lalu tunggu kena TP, kena CL, atau habis waktu.`,
            en: `The same rule replayed ${N} times, once from every session of this stock since ${dateLabel(c.date[21] ?? c.date[0], lang)}: buy at the next open, then wait for the target, the stop, or the time limit.`,
          })}
        </p>

        <div className="mt-5 flex h-3 overflow-hidden rounded-full ring-1 ring-line" aria-hidden>
          <span className="bg-up" style={{ width: `${share("tp") * 100}%` }} />
          <span className="bg-line-strong" style={{ width: `${share("time") * 100}%` }} />
          <span className="bg-down" style={{ width: `${share("sl") * 100}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-[12.5px]">
          <span className="text-up">{tx({ id: "Kena TP", en: "Target hit" })} {Math.round(share("tp") * 100)}%</span>
          <span className="text-muted">{tx({ id: "Habis waktu", en: "Timed out" })} {Math.round(share("time") * 100)}%</span>
          <span className="text-down">{tx({ id: "Kena CL", en: "Stopped" })} {Math.round(share("sl") * 100)}%</span>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          {[
            { k: { id: "Untung", en: "Winners" }, v: `${Math.round(win * 100)}%` },
            { k: { id: "Rata-rata / trade", en: "Average / trade" }, v: signed(avg * 100, 2, "%"), c: tone },
            { k: { id: "Median / trade", en: "Median / trade" }, v: signed(med * 100, 2, "%"), c: med > 0 ? "text-up" : "text-down" },
            { k: { id: "Profit factor", en: "Profit factor" }, v: pf != null ? pf.toFixed(2) : "–", c: pf != null && pf >= 1 ? "text-up" : "text-down" },
          ].map((x) => (
            <div key={x.k.id}>
              <dt className="text-[12px] text-muted">{tx(x.k)}</dt>
              <dd className={`num mt-1 text-2xl font-semibold tracking-tight ${x.c ?? ""}`}>{x.v}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-6 rounded-lg bg-ground/60 p-3 text-[13.5px] leading-relaxed text-ink-2 ring-1 ring-line">
          {N < 30
            ? tx({ id: "Histori saham ini terlalu pendek untuk disimpulkan.", en: "This stock's history is too short to conclude anything." })
            : avg > 0 && (pf ?? 0) >= 1
              ? tx({
                  id: `Di masa lalu, aturan ini di saham ini rata-rata menghasilkan ${signed(avg * 100, 2, "%")} per trade setelah biaya. Dengan modalmu, itu kira-kira Rp${price(Math.round(avg * shares * entry), lang)} per trade, tapi setiap trade bisa jauh lebih buruk.`,
                  en: `Historically this rule on this stock averaged ${signed(avg * 100, 2, "%")} per trade after fees, about IDR ${price(Math.round(avg * shares * entry), lang)} per trade with your capital, though any single trade can be far worse.`,
                })
              : tx({
                  id: `Di masa lalu, aturan ini di saham ini rata-rata ${signed(avg * 100, 2, "%")} per trade setelah biaya, artinya cenderung rugi. Coba profil lain, atau pertimbangkan untuk tidak masuk.`,
                  en: `Historically this rule on this stock averaged ${signed(avg * 100, 2, "%")} per trade after fees, so it tended to lose. Try another profile, or consider staying out.`,
                })}
        </p>

        <p className="mt-4 text-[11.5px] leading-relaxed text-muted">
          <T
            id="Simulasi ini memakai data harian, jadi urutan kejadian di dalam hari tidak diketahui. Kalau CL dan TP tersentuh di hari yang sama, dianggap kena CL duluan; kalau harga dibuka melewati CL, keluar di harga pembukaan. Hasil masa lalu tidak menjamin hasil di masa depan. Ini gambaran dan simulasi, bukan nasihat keuangan atau ajakan membeli atau menjual."
            en="This simulation uses daily data, so the order of events within a day is unknown. If both stop and target are touched on the same day the stop is assumed first; if the price opens through the stop, the exit is at the open. Past results don't guarantee future results. This is an illustration, not financial advice or a recommendation to buy or sell."
          />
        </p>
      </section>
    </div>
  );
}

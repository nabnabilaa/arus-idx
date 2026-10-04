"use client";

import { AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { Segmented } from "@/components/ui";
import { dateLabel, price, signed } from "@/lib/format";
import { T, useLang, type Bi } from "@/lib/i18n";
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
  tight: { sl: 1, tp: 1.5, hold: 2 },
  mid: { sl: 1.5, tp: 3, hold: 5 },
  wide: { sl: 2, tp: 4, hold: 10 },
};
const MODE_LABEL: Record<Mode, Bi> = {
  tight: { id: "Ketat", en: "Tight" },
  mid: { id: "Sedang", en: "Medium" },
  wide: { id: "Longgar", en: "Wide" },
  custom: { id: "Atur sendiri", en: "Custom" },
};

/** The day you'd decide to buy: any day, after a strong up day (chasing euphoria), or after a sharp drop. */
type Cond = "any" | "after_up" | "after_down";
const COND_LABEL: Record<Cond, Bi> = {
  any: { id: "Kapan saja", en: "Any day" },
  after_up: { id: "Setelah naik kencang", en: "After a big up day" },
  after_down: { id: "Setelah turun dalam", en: "After a big down day" },
};
const BIG_MOVE = 1.5; // × the stock's own normal daily move

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

function dayMove(c: Candles, i: number) {
  return i > 0 && c.c[i - 1] ? c.c[i] / c.c[i - 1] - 1 : 0;
}

function condOf(c: Candles, atr: (number | null)[], i: number): Cond {
  const a = atr[i];
  const m = dayMove(c, i);
  if (a == null) return "any";
  return m >= BIG_MOVE * a ? "after_up" : m <= -BIG_MOVE * a ? "after_down" : "any";
}

type Outcome = { ret: number; kind: "tp" | "sl" | "time"; days: number };

/** Replay one bracket order: buy next open, stop assumed first when both touch on one day, gaps fill at the open. */
function replay(c: Candles, atr: (number | null)[], cond: Cond, rule: (entry: number, i: number) => { sl: number; tp: number }, hold: number): Outcome[] {
  const res: Outcome[] = [];
  for (let i = 20; i + hold < c.c.length; i++) {
    const e = c.o[i + 1];
    if (e == null || !(e > 0) || atr[i] == null) continue;
    if (cond !== "any" && condOf(c, atr, i) !== cond) continue;
    const r = rule(e, i);
    let exit: number | null = null;
    let kind: Outcome["kind"] = "time";
    let j = i + 1;
    for (; j <= i + hold; j++) {
      const o = c.o[j] ?? c.c[j], lo = c.l[j] ?? c.c[j], hi = c.h[j] ?? c.c[j];
      if (j > i + 1 && o <= r.sl) { exit = o; kind = "sl"; break; }
      if (lo <= r.sl) { exit = r.sl; kind = "sl"; break; }
      if (j > i + 1 && o >= r.tp) { exit = o; kind = "tp"; break; }
      if (hi >= r.tp) { exit = r.tp; kind = "tp"; break; }
    }
    if (exit == null) {
      j = i + hold;
      exit = c.c[j];
    }
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
  const today = condOf(c, atr, n - 1);

  const [mode, setMode] = useState<Mode>("mid");
  const [cond, setCond] = useState<Cond>("any");
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
  const slDist = 1 - slPrice / entry;
  const tpDist = tpPrice / entry - 1;

  const outcomes = useMemo(
    () =>
      replay(c, atr, cond, (e, i) => (p ? { sl: e * (1 - p.sl * (atr[i] as number)), tp: e * (1 + p.tp * (atr[i] as number)) } : { sl: e * (1 - slPct / 100), tp: e * (1 + tpPct / 100) }), hold),
    [c, atr, cond, p, slPct, tpPct, hold],
  );

  const N = outcomes.length;
  const count = (k: Outcome["kind"]) => outcomes.filter((o) => o.kind === k).length;
  const per100 = (k: Outcome["kind"]) => (N ? Math.round((count(k) / N) * 100) : 0);
  const tpDays = outcomes.filter((o) => o.kind === "tp").map((o) => o.days).sort((a, b) => a - b);
  const medTpDays = tpDays.length ? tpDays[Math.floor(tpDays.length / 2)] : null;
  const avg = N ? outcomes.reduce((a, o) => a + o.ret, 0) / N : 0;

  const lots = Math.floor(cap / (entry * LOT * (1 + BUY_FEE)));
  const shares = lots * LOT;
  const lossRp = shares * (entry * (1 + BUY_FEE) - slPrice * (1 - SELL_FEE));
  const gainRp = shares * (tpPrice * (1 - SELL_FEE) - entry * (1 + BUY_FEE));
  const rr = lossRp > 0 ? gainRp / lossRp : null;
  // with this reward:risk, the target must come first at least this often (of TP+CL outcomes) to break even
  const need = rr != null ? Math.round((1 / (1 + rr)) * 100) : null;
  const decided = count("tp") + count("sl");
  const got = decided ? Math.round((count("tp") / decided) * 100) : null;
  const slTooTight = slDist < atrNow;
  const tpFar = tpDist > atrNow * hold ** 0.5 * 2;

  const field = "num h-10 w-full rounded-lg bg-ground/60 px-3 text-[14px] text-ink ring-1 ring-line-strong focus:outline-none focus:ring-arus/70";

  const verdict: Bi | null =
    N < 15 || got == null || need == null
      ? null
      : got >= need + 5
        ? { id: `Di saham ini, TP datang lebih dulu ${got} dari 100 kali (yang selesai kena TP atau CL). Rasio untung:rugimu butuh minimal ${need} agar impas, jadi rencana ini pernah berjalan baik di saham ini.`, en: `On this stock the target came first ${got} times in 100 (of trades that hit TP or SL). Your reward:risk needs at least ${need} to break even, so this plan has worked here before.` }
        : got >= need - 5
          ? { id: `TP datang lebih dulu ${got} dari 100 kali; impasnya butuh ${need}. Hampir impas: hasilnya lebih ditentukan biaya dan disiplin daripada rencananya.`, en: `The target came first ${got} times in 100; break-even needs ${need}. Roughly break-even: costs and discipline matter more than the plan.` }
          : { id: `TP datang lebih dulu hanya ${got} dari 100 kali, padahal impasnya butuh ${need}. Untuk gaya gerak saham ini, ${tpFar ? "TP-nya terlalu jauh" : slTooTight ? "CL-nya terlalu dekat" : "kombinasinya kurang cocok"}. Coba profil lain atau ubah angkanya.`, en: `The target came first only ${got} times in 100, but break-even needs ${need}. For how this stock moves, ${tpFar ? "the target is too far" : slTooTight ? "the stop is too tight" : "the combination doesn't fit"}. Try another profile or adjust the numbers.` };

  return (
    <div className="space-y-6">
      <p className="max-w-[80ch] text-[14px] leading-relaxed text-ink-2">
        <T
          id="Gunakan ini sebelum masuk: tentukan harga beli, cut loss, dan take profit, lalu lihat seberapa sering rencana seperti itu tercapai di saham ini sendiri. Tujuannya menaruh CL dan TP di tempat yang masuk akal untuk cara saham ini bergerak, bukan menebak naik atau turun."
          en="Use this before entering: set your entry, stop and target, then see how often a plan like that played out on this very stock. The goal is placing stop and target where they make sense for how this stock moves, not guessing up or down."
        />
      </p>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* plan */}
        <section className="rounded-2xl bg-surface p-5 ring-1 ring-line">
          <h3 className="text-[16px] font-semibold">
            <T id="1. Rencanamu" en="1. Your plan" />
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            {tx({
              id: `Gerak normal harian saham ini ±${(atrNow * 100).toFixed(1)}%, jadi wajar besok bergerak di Rp${price(floorTick(last * (1 - atrNow)), lang)} – Rp${price(ceilTick(last * (1 + atrNow)), lang)}.`,
              en: `This stock's normal daily move is ±${(atrNow * 100).toFixed(1)}%, so a typical day tomorrow spans ${price(floorTick(last * (1 - atrNow)), lang)} – ${price(ceilTick(last * (1 + atrNow)), lang)}.`,
            })}
          </p>

          <div className="mt-4">
            <div className="mb-1.5 text-[12px] text-muted"><T id="Jarak CL & TP" en="Stop & target distance" /></div>
            <Segmented<Mode> label={tx({ id: "Profil", en: "Profile" })} value={mode} onChange={setMode} options={(["tight", "mid", "wide", "custom"] as Mode[]).map((m) => ({ value: m, label: tx(MODE_LABEL[m]) }))} />
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
              { k: { id: "Cut loss", en: "Stop loss" }, v: slPrice, m: -slDist, c: "text-down" },
              { k: { id: "Harga beli", en: "Entry" }, v: entry, m: 0, c: "text-ink" },
              { k: { id: "Take profit", en: "Take profit" }, v: tpPrice, m: tpDist, c: "text-up" },
            ].map((x) => (
              <div key={x.k.id} className="rounded-lg bg-ground/60 p-2.5 ring-1 ring-line">
                <dt className="text-[11.5px] text-muted">{tx(x.k)}</dt>
                <dd className={`num mt-0.5 text-[18px] font-semibold ${x.c}`}>{price(x.v, lang)}</dd>
                <dd className="num text-[11.5px] text-muted">{x.m ? signed(x.m * 100, 1, "%") : tx({ id: `tahan ≤${hold} hari`, en: `hold ≤${hold}d` })}</dd>
              </div>
            ))}
          </dl>

          {slTooTight && (
            <p className="mt-3 flex gap-2 rounded-lg bg-warn/10 px-3 py-2 text-[12.5px] leading-relaxed text-ink-2 ring-1 ring-warn/30">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn" />
              {tx({ id: "CL ini lebih dekat dari gerak normal harian, jadi bisa kena hanya karena naik-turun biasa.", en: "This stop sits inside the normal daily move, so ordinary noise can trigger it." })}
            </p>
          )}

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
              <dt className="text-muted"><T id="Untung : rugi" en="Reward : risk" /></dt>
              <dd className="num">{rr != null ? `${rr.toFixed(2)} : 1` : "–"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
            <T id="Sudah termasuk biaya beli 0,15% dan jual 0,25%, dibulatkan ke fraksi harga BEI." en="Includes 0.15% buy and 0.25% sell fees, rounded to IDX tick sizes." />
          </p>
        </section>

        {/* history */}
        <section className="rounded-2xl bg-surface p-5 ring-1 ring-line">
          <h3 className="text-[16px] font-semibold">
            <T id="2. Seberapa sering rencana ini tercapai di saham ini" en="2. How often this plan played out on this stock" />
          </h3>
          <div className="mt-3">
            <div className="mb-1.5 text-[12px] text-muted">
              <T id="Kamu masuk pada hari seperti apa?" en="What kind of day are you buying after?" />
            </div>
            <Segmented<Cond> label={tx({ id: "Kondisi masuk", en: "Entry condition" })} value={cond} onChange={setCond} options={(["any", "after_up", "after_down"] as Cond[]).map((k) => ({ value: k, label: tx(COND_LABEL[k]) }))} />
            <p className="mt-1.5 text-[11.5px] text-muted">
              {tx({
                id: `“Kencang” = gerak lebih dari ${BIG_MOVE}× gerak normal sehari. Hari ini: ${tx(COND_LABEL[today]).toLowerCase()} (${signed(dayMove(c, n - 1) * 100, 1, "%")}).`,
                en: `“Big” = a move over ${BIG_MOVE}× the normal daily move. Today: ${tx(COND_LABEL[today]).toLowerCase()} (${signed(dayMove(c, n - 1) * 100, 1, "%")}).`,
              })}
            </p>
          </div>

          {N < 15 ? (
            <p className="mt-6 text-[13.5px] text-ink-2">
              {tx({ id: `Baru ada ${N} kejadian seperti ini di histori saham ini, terlalu sedikit untuk disimpulkan.`, en: `Only ${N} such cases in this stock's history, too few to conclude.` })}
            </p>
          ) : (
            <>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                {[
                  { k: "tp" as const, l: { id: "TP duluan", en: "Target first" }, c: "text-up" },
                  { k: "sl" as const, l: { id: "CL duluan", en: "Stop first" }, c: "text-down" },
                  { k: "time" as const, l: { id: "Belum ke mana-mana", en: "Neither yet" }, c: "text-ink-2" },
                ].map((x) => (
                  <div key={x.k} className="rounded-lg bg-ground/60 p-3 ring-1 ring-line">
                    <div className={`num text-3xl font-semibold tracking-tight ${x.c}`}>{per100(x.k)}</div>
                    <div className="text-[11.5px] text-muted">{tx(x.l)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex h-2.5 overflow-hidden rounded-full ring-1 ring-line" aria-hidden>
                <span className="bg-up" style={{ width: `${per100("tp")}%` }} />
                <span className="bg-line-strong" style={{ width: `${per100("time")}%` }} />
                <span className="bg-down" style={{ width: `${per100("sl")}%` }} />
              </div>
              <p className="mt-2 text-[12px] text-muted">
                {tx({
                  id: `Dari 100 kali rencana yang sama dijalankan (${N} kejadian sejak ${dateLabel(c.date[21] ?? c.date[0], lang)}).${medTpDays ? ` Kalau kena TP, biasanya dalam ${medTpDays} hari.` : ""} Hasil rata-rata setelah biaya ${signed(avg * 100, 2, "%")} per trade.`,
                  en: `Out of 100 runs of the same plan (${N} cases since ${dateLabel(c.date[21] ?? c.date[0], lang)}).${medTpDays ? ` When the target hit, it usually took ${medTpDays} days.` : ""} Average result after fees ${signed(avg * 100, 2, "%")} per trade.`,
                })}
              </p>

              {verdict && <p className="mt-5 rounded-lg bg-ground/60 p-3.5 text-[13.5px] leading-relaxed text-ink ring-1 ring-line">{tx(verdict)}</p>}
            </>
          )}

          <p className="mt-5 text-[11.5px] leading-relaxed text-muted">
            <T
              id="Dihitung dari data harian. Trade yang selesai dalam hitungan jam tidak bisa dinilai di sini; angka ini menggambarkan jangkauan gerak antarhari. Kalau CL dan TP tersentuh di hari yang sama, dianggap kena CL dulu. Hasil masa lalu tidak menjamin hasil berikutnya. Ini simulasi untuk gambaran, bukan nasihat keuangan atau ajakan membeli atau menjual."
              en="Computed from daily data. Trades closed within hours can't be judged here; these numbers describe moves across days. If stop and target touch on the same day, the stop is assumed first. Past results don't guarantee future ones. This is an illustration, not financial advice or a recommendation to buy or sell."
            />
          </p>
        </section>
      </div>
    </div>
  );
}

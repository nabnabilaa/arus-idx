"use client";

import { motion } from "motion/react";
import { C } from "@/components/charts/kit";
import { pct } from "@/lib/format";
import { T, useLang } from "@/lib/i18n";
import type { FinHealth, Stock } from "@/lib/types";

const EASE = [0.23, 1, 0.32, 1] as const;
/** Cost of equity for the simple justified P/B (ROE ÷ r): ~6.5% Indonesian 10-year yield + ~5.5% equity premium. */
export const COST_OF_EQUITY = 0.12;

export type ValPeer = { symbol: string; pb: number; roe: number; sub: boolean };

/**
 * What the market pays per unit of ROE among peers: the median of P/B ÷ ROE over profitable
 * peers (sub-sector when it has 6+, else sector). A median ratio stays sensible with a dozen
 * noisy points where a regression line swings wildly.
 */
function fit(peers: ValPeer[]) {
  const usable = (p: ValPeer) => p.pb > 0 && p.pb < 15 && p.roe > 0.03;
  const sub = peers.filter((p) => p.sub && usable(p));
  const pts = sub.length >= 6 ? sub : peers.filter(usable);
  if (pts.length < 6) return null;
  const r = pts.map((p) => p.pb / p.roe).sort((x, y) => x - y);
  const k = r.length % 2 ? r[(r.length - 1) / 2] : (r[r.length / 2 - 1] + r[r.length / 2]) / 2;
  return { a: 0, b: k, pts, level: sub.length >= 6 ? ("sub" as const) : ("sector" as const) };
}

function Scatter({ s, pts, line }: { s: { pb: number; roe: number }; pts: ValPeer[]; line: { a: number; b: number } | null }) {
  const W = 360;
  const H = 200;
  const pad = { l: 34, r: 10, t: 10, b: 26 };
  const xs = [...pts.map((p) => p.roe), s.roe, 0];
  const ys = [...pts.map((p) => p.pb), s.pb, 0];
  const x0 = Math.min(...xs) - 0.02;
  const x1 = Math.max(...xs) + 0.02;
  const y1 = Math.max(...ys) * 1.08;
  const x = (v: number) => pad.l + ((v - x0) / (x1 - x0)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / y1) * (H - pad.t - pad.b);
  const ticksY = [0, y1 / 2, y1].map((v) => Math.round(v * 10) / 10);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="P/B vs ROE">
      {ticksY.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={C.grid} />
          <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill={C.muted}>{`${t}×`}</text>
        </g>
      ))}
      {[x0, (x0 + x1) / 2, x1].map((t) => (
        <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize={9} fill={C.muted}>{`${Math.round(t * 100)}%`}</text>
      ))}
      {line && (
        <motion.line
          x1={x(x0)} y1={y(Math.max(0, line.a + line.b * x0))} x2={x(x1)} y2={y(Math.max(0, line.a + line.b * x1))}
          stroke={C.ink2} strokeDasharray="4 4" strokeWidth={1.2}
          initial={{ pathLength: 0, opacity: 0 }} whileInView={{ pathLength: 1, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE }}
        />
      )}
      {pts.map((p, i) => (
        <motion.circle key={p.symbol} cx={x(p.roe)} cy={y(Math.min(p.pb, y1))} r={3.2} fill={C.muted} opacity={0.55}
          initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.2, delay: 0.2 + i * 0.01 }}>
          <title>{`${p.symbol} · PBV ${p.pb.toFixed(2)}× · ROE ${(p.roe * 100).toFixed(1)}%`}</title>
        </motion.circle>
      ))}
      <motion.circle cx={x(s.roe)} cy={y(Math.min(s.pb, y1))} r={6} fill={C.current} stroke="#070b14" strokeWidth={2}
        initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.6 }} />
      <text x={pad.l + 6} y={pad.t + 20} fontSize={9} fill={C.muted}>PBV</text>
      <text x={W - pad.r} y={H - pad.b - 6} textAnchor="end" fontSize={9} fill={C.muted}>ROE</text>
    </svg>
  );
}

/** "Cheap or just priced right?" — P/B read against the return on equity that justifies it. */
export function PbRoe({ s, peers, fin }: { s: Stock; peers: ValPeer[]; fin: FinHealth | null }) {
  const { tx, lang } = useLang();
  if (s.pb_mrq == null || s.pb_mrq <= 0 || s.roe_ttm == null) return null;
  const pb = s.pb_mrq;
  const roe = s.roe_ttm;
  const line = fit(peers);
  const sector = line && roe > 0 ? line.b * roe : null;
  const simple = roe > 0 ? roe / COST_OF_EQUITY : null;
  const ref = sector ?? simple;
  const ratio = ref ? pb / ref : null;
  const verdict =
    roe <= 0
      ? { tone: "text-[#f0a3a3]", t: { id: "ROE negatif: PBV rendah di sini bukan diskon", en: "Negative ROE: a low P/B here is no discount" } }
      : ratio == null
        ? null
        : ratio < 0.8
          ? { tone: "text-[#7fd4a8]", t: { id: "Lebih murah dari yang dibenarkan ROE-nya", en: "Cheaper than its ROE justifies" } }
          : ratio > 1.25
            ? { tone: "text-warn", t: { id: "Lebih mahal dari yang dibenarkan ROE-nya", en: "Pricier than its ROE justifies" } }
            : { tone: "text-ink", t: { id: "Harganya sesuai dengan ROE-nya", en: "Priced in line with its ROE" } };

  const roeHist =
    fin?.years.map((yr, i) => {
      const e = fin.series.earnings[i];
      const eq = fin.series.total_equity[i];
      return { yr, roe: e != null && eq ? e / eq : null };
    }) ?? [];
  const steady = roeHist.filter((h) => h.roe != null);
  const fmtX = (v: number | null) => (v == null ? "–" : `${v.toLocaleString(lang === "id" ? "id-ID" : "en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}×`);

  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-line">
      <h3 className="text-[15px] font-semibold">
        <T id="Murah, atau memang segitu harganya?" en="Cheap, or just priced right?" />
      </h3>
      <p className="mt-1 max-w-[80ch] text-[12.5px] leading-relaxed text-muted">
        <T
          id="PBV rendah belum tentu murah. Perusahaan yang hanya menghasilkan laba kecil dari modalnya (ROE rendah) memang pantas dihargai rendah. Jadi PBV dibaca bersama ROE: dibanding sesama sektornya, dan dibanding biaya modal 12% setahun."
          en="A low P/B isn't automatically cheap. A company earning little on its equity (low ROE) deserves a low price. So P/B is read together with ROE: against sector peers, and against a 12% yearly cost of equity."
        />
      </p>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
        <div>
          {verdict && <div className={`text-xl font-semibold tracking-tight ${verdict.tone}`}>{tx(verdict.t)}</div>}
          <dl className="mt-4 grid grid-cols-2 gap-2">
            {[
              [tx({ id: "PBV sekarang", en: "P/B now" }), fmtX(pb)],
              [tx({ id: "ROE (TTM)", en: "ROE (TTM)" }), pct(roe, 1)],
              [line?.level === "sub" ? tx({ id: "PBV subsektor untuk ROE ini", en: "Sub-sector P/B for this ROE" }) : tx({ id: "PBV sektor untuk ROE ini", en: "Sector P/B for this ROE" }), fmtX(sector)],
              [tx({ id: "PBV wajar (ROE ÷ 12%)", en: "Justified P/B (ROE ÷ 12%)" }), fmtX(simple)],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-ground/60 px-3 py-2.5 ring-1 ring-line">
                <dt className="text-[12px] text-muted">{l}</dt>
                <dd className="num text-[16px] text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {steady.length >= 3 && (
            <div className="mt-4">
              <div className="text-[12px] text-muted">{tx({ id: "ROE dari laporan tahunan", en: "ROE from annual reports" })}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {roeHist.map((h) => (
                  <span key={h.yr} className={`num rounded-md px-2 py-1 text-[12px] ring-1 ring-line ${h.roe == null ? "text-muted" : h.roe >= COST_OF_EQUITY ? "text-[#7fd4a8]" : h.roe > 0 ? "text-ink-2" : "text-[#f0a3a3]"}`}>
                    {h.yr} · {pct(h.roe, 0)}
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-[12px] text-muted">
                {tx({ id: "Hijau: di atas biaya modal 12%. ROE yang stabil membuat PBV tinggi lebih bisa dibenarkan.", en: "Green: above the 12% cost of equity. A steady ROE makes a higher P/B easier to justify." })}
              </p>
            </div>
          )}
        </div>
        {line && (
          <div className="mx-auto w-full max-w-[460px]">
            <Scatter s={{ pb, roe }} pts={line.pts} line={line} />
            <p className="mt-1 text-[12px] text-muted">
              {tx({
                id: `Titik abu-abu: ${line.pts.length} saham ${line.level === "sub" ? "sesubsektor" : "sesektor"} yang laba. Garis putus-putus: PBV yang biasa diberikan pasar untuk tiap tingkat ROE (median PBV ÷ ROE, sekitar ${(line.b * 0.1).toFixed(2).replace(".", ",")}× per 10% ROE). Titik biru: ${s.symbol}. Di bawah garis berarti lebih murah dari sesamanya.`,
                en: `Grey dots: ${line.pts.length} profitable ${line.level === "sub" ? "sub-sector" : "sector"} peers. Dashed line: the P/B the market usually pays for each level of ROE (median P/B ÷ ROE, about ${(line.b * 0.1).toFixed(2)}× per 10% ROE). Blue dot: ${s.symbol}. Below the line means cheaper than peers.`,
              })}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

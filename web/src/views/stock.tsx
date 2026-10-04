"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ChevronDown, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { ArusMeter } from "@/components/arus-meter";
import { CandleChart } from "@/components/charts/candles";
import { Term } from "@/components/term";
import { Badge, HorizonToggle, StarButton, VerdictBadge } from "@/components/ui";
import { FAMILY, FEATURE, SECTOR_ID, SUBSECTOR_ID, describe, type FamilyKey } from "@/lib/features";
import { idr, pct, price, signed } from "@/lib/format";
import { T, useLang } from "@/lib/i18n";
import { BROKER_VERDICT, headline, reasonMeaning, risks } from "@/lib/narrative";
import { usePrefs } from "@/lib/prefs";
import type { Broker, Candles, FeatureKey, Horizon, Stock } from "@/lib/types";
import { get, HORIZON_LABEL, verdictOf } from "@/lib/verdict";

type Props = {
  stock: Stock;
  candles: Candles | null;
  broker: Broker | null;
  cal: Record<Horizon, { a: number; b: number }>;
  weights: Record<Horizon, Record<string, number>>;
  families: Record<string, FeatureKey[]>;
  total: number;
  peers: { symbol: string; name: string | null; q_1: number | null; q_20: number | null; conf_1: number | null; conf_20: number | null }[];
};

const EASE = [0.23, 1, 0.32, 1] as const;
const fade = (i = 0) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay: 0.05 + i * 0.06, ease: EASE } });

export function StockView({ stock: s, candles, broker, cal, weights, families, peers }: Props) {
  const { tx, lang } = useLang();
  const { horizon } = usePrefs();
  const [showAll, setShowAll] = useState(false);
  const g = get(s, horizon);
  const other: Horizon = horizon === 1 ? 20 : 1;
  const go = get(s, other);
  const v = verdictOf(g.q);
  const pctl = (k: FeatureKey) => (s as unknown as Record<string, number | null>)[k];
  const sub = s.sub_sector ? (lang === "id" ? SUBSECTOR_ID[s.sub_sector] ?? s.sub_sector : s.sub_sector) : "";
  const sec = s.sector ? (lang === "id" ? SECTOR_ID[s.sector] ?? s.sector : s.sector) : "";

  const reasons = (Object.keys(FEATURE) as FeatureKey[])
    .map((k) => ({ k, c: g.contrib(k) }))
    .sort((a, b) => Math.abs(b.c) - Math.abs(a.c));
  const helping = reasons.filter((r) => r.c > 0.005).slice(0, 3);
  const hurting = reasons.filter((r) => r.c < -0.005).slice(0, 3);

  const atrRp = s.atr_pct != null && s.price != null ? s.atr_pct * s.price : null;
  const levels = [
    { value: s.resistance_20 ?? NaN, label: { id: "Batas atas 1 bln", en: "1-mo ceiling" }, color: "#aab5c7" },
    { value: s.support_20 ?? NaN, label: { id: "Batas bawah 1 bln", en: "1-mo floor" }, color: "#aab5c7" },
    { value: s.invalidate ?? NaN, label: { id: "Sinyal batal", en: "Signal void" }, color: "#e66767" },
  ];

  return (
    <div className="pt-6 sm:pt-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={14} />
        <T id="Semua saham" en="All stocks" />
      </Link>

      {/* HEADER */}
      <motion.header {...fade(0)} className="mt-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">{s.symbol}</h1>
            <StarButton symbol={s.symbol} size={18} />
            {s.sharia && (
              <Term k="sharia">
                <Badge tone="good">{tx({ id: "Syariah", en: "Sharia" })}</Badge>
              </Term>
            )}
            {s.suspended_recent && <Badge tone="warn">{tx({ id: "Pernah disuspensi 90h", en: "Suspended within 90d" })}</Badge>}
          </div>
          <p className="mt-1.5 text-[15px] text-ink-2">
            {s.name} <span className="text-muted">· {sec} · {sub}</span>
          </p>
        </div>
        <dl className="flex gap-6 sm:gap-8">
          <div>
            <dt className="text-xs text-muted">
              <T id="Harga" en="Price" />
            </dt>
            <dd className="num text-2xl">{price(s.price, lang)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">
              <T id="Hari ini" en="Today" />
            </dt>
            <dd className={`num text-2xl ${(s.ret_1 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{signed((s.ret_1 ?? 0) * 100, 1, "%")}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">
              <T id="1 bulan" en="1 month" />
            </dt>
            <dd className={`num text-2xl ${(s.ret_20 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{signed((s.ret_20 ?? 0) * 100, 1, "%")}</dd>
          </div>
        </dl>
      </motion.header>

      {/* METER + CHART */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-10">
        <motion.section {...fade(1)} className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
            <div className="flex justify-center">
              <HorizonToggle />
            </div>
            <div className="mt-4">
              <ArusMeter value={g.conf} q={g.q} cal={cal[horizon]} size={290} />
            </div>
            <p className="mt-5 text-[14px] leading-relaxed text-ink-2">{tx(headline(s, horizon))}</p>
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
              <Term k="evidence">
                <T id={`Dihitung dari ±${Math.round(g.nEff)} kejadian serupa`} en={`Built on ~${Math.round(g.nEff)} similar cases`} />
              </Term>
              {g.lo != null && g.hi != null && (
                <>
                  {" · "}
                  <Term k="range">
                    <T id="rentang" en="range" /> {Math.round(g.lo * 100)}–{Math.round(g.hi * 100)}
                  </Term>
                </>
              )}
            </p>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-ground/60 px-3 py-2.5 text-[13px] ring-1 ring-line">
              <span className="text-muted">
                <T id="Untuk" en="For" /> {tx(HORIZON_LABEL[other].name).toLowerCase()}:
              </span>
              <span className="flex items-center gap-2">
                <span className="num font-semibold text-ink">{Math.round(go.conf * 100)}</span>
                <VerdictBadge v={verdictOf(go.q)} />
              </span>
            </div>
          </div>
        </motion.section>

        <motion.section {...fade(2)} className="min-w-0">
          {candles ? (
            <CandleChart data={candles} levels={levels} height={460} />
          ) : (
            <p className="text-muted">
              <T id="Data grafik tidak tersedia." en="Chart data unavailable." />
            </p>
          )}

          {/* KEY LEVELS */}
          <div className="mt-6">
            <h2 className="text-[15px] font-semibold">
              <T id="Level penting hari ini" en="Key levels today" />
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted">
                  <Term k="normalRange">
                    <T id="Gerak normal harian" en="Normal daily move" />
                  </Term>
                </dt>
                <dd className="num mt-1 text-lg text-ink">±{pct(s.atr_pct, 1)}</dd>
                <dd className="num text-xs text-muted">≈ Rp{price(atrRp, lang)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">
                  <Term k="supportResistance">
                    <T id="Batas bawah 1 bln" en="1-mo floor" />
                  </Term>
                </dt>
                <dd className="num mt-1 text-lg text-ink">{price(s.support_20, lang)}</dd>
                <dd className="num text-xs text-muted">{s.price && s.support_20 ? signed((s.support_20 / s.price - 1) * 100, 1, "%") : ""}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">
                  <Term k="supportResistance">
                    <T id="Batas atas 1 bln" en="1-mo ceiling" />
                  </Term>
                </dt>
                <dd className="num mt-1 text-lg text-ink">{price(s.resistance_20, lang)}</dd>
                <dd className="num text-xs text-muted">{s.price && s.resistance_20 ? signed((s.resistance_20 / s.price - 1) * 100, 1, "%") : ""}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">
                  <Term k="invalidate">
                    <T id="Batas sinyal batal" en="Signal void below" />
                  </Term>
                </dt>
                <dd className="num mt-1 text-lg text-[#f0a3a3]">{price(s.invalidate, lang)}</dd>
                <dd className="num text-xs text-muted">{s.price && s.invalidate ? signed((s.invalidate / s.price - 1) * 100, 1, "%") : ""}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              <T
                id="Level ini dihitung otomatis dari harga 1 bulan terakhir sebagai informasi, bukan saran beli atau jual."
                en="These levels are computed from the last month of prices as information, not buy or sell advice."
              />
            </p>
          </div>
        </motion.section>
      </div>

      {/* WHY */}
      <motion.section {...fade(3)} className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">
          <T id="Kenapa skornya segini" en="Why the score is what it is" />
        </h2>
        <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-muted">
          <T
            id="Arus membaca 14 kondisi saham ini, lalu menimbangnya berdasarkan apa yang benar-benar terbukti menang dalam setahun terakhir. Ini kondisi yang paling berpengaruh:"
            en="Arus reads 14 conditions of this stock and weighs them by what actually won over the past year. These matter most:"
          />
        </p>
        <div className="mt-6 grid gap-10 md:grid-cols-2">
          {[
            { title: { id: "Yang mendukung", en: "Working for it" }, list: helping, helps: true },
            { title: { id: "Yang menahan", en: "Working against it" }, list: hurting, helps: false },
          ].map((col) => (
            <div key={col.title.en}>
              <h3 className={`mb-3 text-[14px] font-semibold ${col.helps ? "text-[#9cc5f5]" : "text-[#f0a3a3]"}`}>{tx(col.title)}</h3>
              {col.list.length === 0 ? (
                <p className="text-[14px] text-muted">
                  <T id="Tidak ada yang menonjol." en="Nothing stands out." />
                </p>
              ) : (
                <ul className="space-y-4">
                  {col.list.map((r) => (
                    <li key={r.k} className="flex gap-3">
                      <span className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[12px] font-bold ${col.helps ? "bg-up/15 text-[#9cc5f5]" : "bg-down/15 text-[#f0a3a3]"}`}>{col.helps ? "+" : "−"}</span>
                      <div>
                        <div className="text-[15px] font-medium text-ink">{tx(describe(r.k, pctl(r.k)))}</div>
                        <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-2">{tx(reasonMeaning(r.k, weights[horizon][r.k] ?? 0, pctl(r.k)))}</p>
                        <p className="mt-0.5 text-[12px] text-muted">
                          {tx(FAMILY[FEATURE[r.k].family].label)} · <T id="lebih kuat dari" en="stronger than" /> {Math.round((pctl(r.k) ?? 0.5) * 100)}% <T id="saham lain hari ini" en="of stocks today" />
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <button onClick={() => setShowAll((x) => !x)} aria-expanded={showAll} className="mt-8 flex cursor-pointer items-center gap-1.5 text-[13px] text-arus hover:underline">
          {showAll ? <T id="Sembunyikan semua sinyal" en="Hide all signals" /> : <T id="Lihat ke-14 sinyal" en="See all 14 signals" />}
          <ChevronDown size={14} className={`transition-transform duration-200 ${showAll ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence initial={false}>
          {showAll && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }} className="overflow-hidden">
              <div className="grid gap-8 pt-6 sm:grid-cols-2 lg:grid-cols-3">
                {(Object.entries(families) as [FamilyKey, FeatureKey[]][]).map(([fam, feats]) => (
                  <div key={fam}>
                    <h4 className="text-[14px] font-semibold">{tx(FAMILY[fam].label)}</h4>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{tx(FAMILY[fam].what)}</p>
                    <ul className="mt-3 space-y-2">
                      {feats.map((k) => {
                        const c = g.contrib(k);
                        return (
                          <li key={k} className="flex items-center justify-between gap-3 text-[13px]">
                            <span className="text-ink-2">{tx(describe(k, pctl(k)))}</span>
                            <span className="flex items-center gap-2">
                              <span className="relative h-1.5 w-16 rounded-full bg-raised">
                                <span
                                  className={`absolute top-0 h-1.5 rounded-full ${c >= 0 ? "bg-up" : "bg-down"}`}
                                  style={{ width: `${Math.min(50, Math.abs(c) * 400)}%`, ...(c >= 0 ? { left: "50%" } : { right: "50%" }) }}
                                />
                              </span>
                              <span className={`num w-7 text-right text-[11px] ${c >= 0 ? "text-up" : "text-down"}`}>{c >= 0 ? "+" : "−"}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* WHAT HAPPENED BEFORE */}
      <motion.section {...fade(4)} className="mt-16 max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-tight">
          <T id="Apa yang terjadi pada kondisi serupa dulu" en="What happened in similar cases" />
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          {g.excess != null && g.p25 != null && g.p75 != null ? (
            <T
              id={`Dibanding IHSG ${tx(HORIZON_LABEL[horizon].long)}, saham dengan kondisi serupa rata-rata bergerak ${signed(g.excess * 100, 1, "%")}. Separuh kejadian berakhir di antara ${signed(g.p25 * 100, 1, "%")} dan ${signed(g.p75 * 100, 1, "%")}. Artinya, hasil satu saham bisa sangat berbeda dari rata-rata: skor membantu memilih peluang, bukan menjamin hasil.`}
              en={`Against IHSG ${tx(HORIZON_LABEL[horizon].long)}, stocks in similar situations moved ${signed(g.excess * 100, 1, "%")} on average. Half of the cases ended between ${signed(g.p25 * 100, 1, "%")} and ${signed(g.p75 * 100, 1, "%")}. A single stock can land far from the average: the score helps pick odds, it does not guarantee outcomes.`}
            />
          ) : (
            "–"
          )}
        </p>
      </motion.section>

      {/* CONTEXT */}
      <motion.section {...fade(5)} className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">
          <T id="Informasi tambahan" en="Extra context" />
        </h2>
        <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-muted">
          <T
            id="Untuk Anda pertimbangkan sendiri. Bagian ini tidak memengaruhi skor, karena datanya hanya tersedia untuk hari ini sehingga tidak bisa diuji ke masa lalu dengan jujur."
            en="For you to weigh yourself. This section doesn't affect the score, because the data exists only for today and can't be tested on the past honestly."
          />
        </p>
        <div className="mt-8 grid gap-x-12 gap-y-12 lg:grid-cols-3">
          <div>
            <h3 className="text-[15px] font-semibold">
              <Term k="broker">
                <T id="Jejak bandar (20 hari)" en="Broker footprint (20 days)" />
              </Term>
            </h3>
            {broker ? (
              <>
                <p className={`mt-3 text-[15px] leading-snug ${broker.tone === "pos" ? "text-[#9cc5f5]" : broker.tone === "neg" ? "text-[#f0a3a3]" : "text-ink-2"}`}>
                  {tx(BROKER_VERDICT[broker.verdict] ?? { id: broker.verdict, en: broker.verdict })}
                </p>
                <dl className="mt-4 space-y-2 text-[13px]">
                  {(
                    [
                      [{ id: "Broker institusi", en: "Institutional brokers" }, broker.inst_net],
                      [{ id: "Broker ritel", en: "Retail brokers" }, broker.retail_net],
                      [{ id: "Investor asing", en: "Foreign investors" }, broker.foreign_investor_net],
                    ] as [{ id: string; en: string }, number][]
                  ).map(([l, val]) => (
                    <div key={l.en} className="flex justify-between gap-4">
                      <dt className="text-ink-2">{tx(l)}</dt>
                      <dd className={`num ${val >= 0 ? "text-up" : "text-down"}`}>{idr(val, lang)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 text-[12.5px] text-muted">
                  <T id="Pembeli terbesar:" en="Top buyers:" />{" "}
                  <span className="text-ink-2">{broker.top_buyers.slice(0, 3).map((b) => b.code).join(", ")}</span>
                  {" · "}
                  <T id="Penjual terbesar:" en="Top sellers:" />{" "}
                  <span className="text-ink-2">{broker.top_sellers.slice(0, 3).map((b) => b.code).join(", ")}</span>
                </div>
              </>
            ) : (
              <p className="mt-3 text-[13px] leading-relaxed text-muted">
                <T id="Data broker diambil untuk 30 saham peringkat teratas saja, supaya kuota data dipakai di tempat paling penting." en="Broker data is pulled for the top 30 stocks only, so data quota goes where it matters most." />
              </p>
            )}
          </div>

          <div>
            <h3 className="text-[15px] font-semibold">
              <T id="Fundamental dibanding sesama sektor" en="Fundamentals vs sector peers" />
            </h3>
            <div className="mt-4 space-y-4">
              {(
                [
                  [{ id: "Seberapa murah (valuasi)", en: "How cheap (valuation)" }, s.pct_value],
                  [{ id: "Kualitas bisnis (ROE, utang)", en: "Business quality (ROE, debt)" }, s.pct_quality],
                  [{ id: "Pertumbuhan laba & pendapatan", en: "Earnings & revenue growth" }, s.pct_growth],
                ] as [{ id: string; en: string }, number | null][]
              ).map(([l, val]) => (
                <div key={l.en}>
                  <div className="mb-1.5 flex justify-between text-[13px]">
                    <span className="text-ink-2">{tx(l)}</span>
                    <span className="text-ink">{val != null ? (val >= 0.67 ? tx({ id: "Di atas rata-rata", en: "Above average" }) : val >= 0.33 ? tx({ id: "Rata-rata", en: "Average" }) : tx({ id: "Di bawah rata-rata", en: "Below average" })) : "–"}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-raised">
                    {val != null && <motion.div className="h-1.5 rounded-full bg-arus" initial={{ width: 0 }} animate={{ width: `${Math.max(3, val * 100)}%` }} viewport={{ once: true }} transition={{ duration: 0.7, ease: EASE }} />}
                  </div>
                </div>
              ))}
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
              {[
                ["PER", s.pe_ttm != null ? `${s.pe_ttm.toFixed(1)}×` : "–"],
                ["PBV", s.pb_mrq != null ? `${s.pb_mrq.toFixed(2)}×` : "–"],
                ["ROE", pct(s.roe_ttm, 1)],
                [tx({ id: "Dividen", en: "Yield" }), pct(s.yield_ttm, 1)],
              ].map(([l, val]) => (
                <div key={l} className="flex justify-between">
                  <dt className="text-muted">{l}</dt>
                  <dd className="num text-ink">{val}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <h3 className="text-[15px] font-semibold">
              <T id="Orang dalam & kejadian tak biasa" en="Insiders & unusual activity" />
            </h3>
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">
              {(s.insider_buys ?? 0) + (s.insider_sells ?? 0) > 0 ? (
                <T
                  id={`Dalam 90 hari, orang dalam perusahaan melapor ${s.insider_buys ?? 0} kali membeli dan ${s.insider_sells ?? 0} kali menjual.`}
                  en={`Over 90 days, company insiders reported ${s.insider_buys ?? 0} purchases and ${s.insider_sells ?? 0} sales.`}
                />
              ) : (
                <T id="Tidak ada laporan transaksi orang dalam dalam 90 hari terakhir." en="No insider transactions reported in the last 90 days." />
              )}
            </p>
            <ul className="mt-4 space-y-2.5 text-[13px]">
              {(
                [
                  [{ id: "Dana asing hari ini", en: "Foreign flow today" }, s.z_foreign],
                  [{ id: "Volume hari ini", en: "Volume today" }, s.z_volume],
                  [{ id: "Gerak harga hari ini", en: "Price move today" }, s.z_return],
                ] as [{ id: string; en: string }, number | null][]
              ).map(([l, z]) => (
                <li key={l.en} className="flex items-center justify-between gap-3">
                  <span className="text-ink-2">{tx(l)}</span>
                  <Term k="anomaly">
                    <span className={`num ${z != null && Math.abs(z) >= 3 ? "text-arus" : "text-ink"}`}>
                      {z == null ? "–" : Math.abs(z) >= 3 ? tx({ id: "Sangat tidak biasa", en: "Very unusual" }) : Math.abs(z) >= 2 ? tx({ id: "Agak tidak biasa", en: "Somewhat unusual" }) : tx({ id: "Normal", en: "Normal" })}
                    </span>
                  </Term>
                </li>
              ))}
            </ul>
            {s.pos_52w != null && (
              <div className="mt-5">
                <div className="mb-1.5 flex justify-between text-[13px]">
                  <span className="text-ink-2">
                    <T id="Posisi harga dalam setahun" en="Price position over the year" />
                  </span>
                  <span className="text-ink">{s.pos_52w > 0.8 ? tx({ id: "Dekat puncak", en: "Near the high" }) : s.pos_52w < 0.2 ? tx({ id: "Dekat dasar", en: "Near the low" }) : tx({ id: "Di tengah", en: "Mid-range" })}</span>
                </div>
                <div className="relative h-1.5 rounded-full bg-raised">
                  <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-arus ring-2 ring-ground" style={{ left: `${s.pos_52w * 100}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-[10.5px] text-muted">
                  <span>{tx({ id: "terendah", en: "low" })}</span>
                  <span>{tx({ id: "tertinggi", en: "high" })}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.section>

      {/* RISKS + PEERS */}
      <motion.section {...fade(6)} className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ShieldAlert size={20} className="text-warn" />
            <T id="Perlu diperhatikan" en="Worth watching" />
          </h2>
          <ul className="mt-5 space-y-3 text-[14px] leading-relaxed text-ink-2">
            {risks(s, broker).map((r, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
                {tx(r)}
              </li>
            ))}
          </ul>
        </div>
        {peers.length > 0 && (
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              <T id="Sesama sektor" en="Sector peers" />
            </h2>
            <ul className="mt-5 divide-y divide-line border-y border-line">
              {peers.map((p) => {
                const conf = horizon === 1 ? p.conf_1 : p.conf_20;
                const q = horizon === 1 ? p.q_1 : p.q_20;
                return (
                  <li key={p.symbol}>
                    <Link href={`/saham/${p.symbol}/`} className="flex items-center justify-between gap-3 py-3 text-[14px] hover:text-arus">
                      <span className="min-w-0">
                        <span className="font-medium">{p.symbol}</span> <span className="truncate text-[12px] text-muted">{p.name}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <VerdictBadge v={verdictOf(q)} />
                        <span className="num w-7 text-right text-ink">{Math.round((conf ?? 0.5) * 100)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </motion.section>
    </div>
  );
}

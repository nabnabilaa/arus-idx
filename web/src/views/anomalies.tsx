"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useState } from "react";
import { Segmented, VerdictBadge } from "@/components/ui";
import { price } from "@/lib/format";
import { T, useLang, type Bi } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import type { Stock } from "@/lib/types";
import { get, verdictOf } from "@/lib/verdict";

type Kind = "any" | "foreign" | "volume" | "return";
type Level = 2 | 3 | 4;

/**
 * Robust z-scores (median ± 1.4826·MAD over the stock's own last 60 days), turned into words.
 * Under a normal distribution |z| ≥ 2 happens ~1 day in 20, ≥ 3 ~1 in 370, ≥ 4 ~1 in 15,000;
 * real markets have fatter tails, so the rarity is phrased loosely.
 */
const LEVELS: Record<Level, { label: Bi; rarity: Bi }> = {
  2: { label: { id: "Agak tidak biasa", en: "Somewhat unusual" }, rarity: { id: "kira-kira sekali dalam sebulan untuk saham itu", en: "roughly once a month for that stock" } },
  3: { label: { id: "Sangat tidak biasa", en: "Very unusual" }, rarity: { id: "jarang terjadi, kira-kira beberapa kali setahun untuk saham itu", en: "rare, roughly a few times a year for that stock" } },
  4: { label: { id: "Ekstrem", en: "Extreme" }, rarity: { id: "sangat langka untuk saham itu", en: "very rare for that stock" } },
};

function level(z: number | null): Level | 0 {
  const a = Math.abs(z ?? 0);
  return a >= 4 ? 4 : a >= 3 ? 3 : a >= 2 ? 2 : 0;
}

const WHAT: Record<Exclude<Kind, "any">, { up: Bi; down: Bi }> = {
  foreign: { up: { id: "Asing borong besar", en: "Heavy foreign buying" }, down: { id: "Asing jual besar", en: "Heavy foreign selling" } },
  volume: { up: { id: "Volume melonjak", en: "Volume spike" }, down: { id: "Volume sangat sepi", en: "Volume dried up" } },
  return: { up: { id: "Harga naik tajam", en: "Sharp price rise" }, down: { id: "Harga turun tajam", en: "Sharp price drop" } },
};

export function AnomaliesView({ ranking }: { ranking: Stock[] }) {
  const { tx, lang } = useLang();
  const { horizon } = usePrefs();
  const [kind, setKind] = useState<Kind>("any");
  const [min, setMin] = useState<Level>(3);

  const z = (r: Stock, k: Exclude<Kind, "any">) => (k === "foreign" ? r.z_foreign : k === "volume" ? r.z_volume : r.z_return);
  const strength = (r: Stock) =>
    kind === "any" ? Math.max(...(["foreign", "volume", "return"] as const).map((k) => Math.abs(z(r, k) ?? 0))) : Math.abs(z(r, kind) ?? 0);
  const rows = ranking.filter((r) => strength(r) >= min).sort((a, b) => strength(b) - strength(a));

  const cell = (r: Stock, k: Exclude<Kind, "any">) => {
    const v = z(r, k);
    const lv = level(v);
    if (!lv) return <span className="text-muted">{tx({ id: "Normal", en: "Normal" })}</span>;
    const up = (v ?? 0) > 0;
    return (
      <span className="flex flex-col items-end">
        <span className={up ? "text-[#9cc5f5]" : "text-[#f0a3a3]"}>{tx(up ? WHAT[k].up : WHAT[k].down)}</span>
        <span className="text-[11px] text-muted">{tx(LEVELS[lv].label)}</span>
      </span>
    );
  };

  return (
    <div className="pt-10 sm:pt-12">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }} className="max-w-3xl">
        <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-balance sm:text-5xl">
          <T id="Saham yang hari ini bertingkah tidak biasa" en="Stocks acting out of character today" />
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
          <T
            id="Arus membandingkan setiap saham dengan kebiasaannya sendiri selama 3 bulan terakhir, bukan dengan saham lain. Volume dua kali lipat itu biasa untuk saham kecil yang liar, tapi luar biasa untuk bank besar. Halaman ini menampilkan yang hari ini keluar dari kebiasaannya."
            en="Arus compares every stock with its own habits over the last 3 months, not with other stocks. Double volume is routine for a wild small cap but extraordinary for a large bank. This page shows the ones breaking their habits today."
          />
        </p>
      </motion.header>

      <section className="mt-10 grid gap-8 rounded-2xl bg-surface p-5 ring-1 ring-line sm:p-6 lg:grid-cols-2">
        <div>
          <div className="text-[14px] font-semibold">
            <T id="Apa yang ingin dilihat?" en="What do you want to see?" />
          </div>
          <div className="mt-3">
            <Segmented
              label={tx({ id: "Jenis kejadian", en: "Event type" })}
              value={kind}
              onChange={setKind}
              options={[
                { value: "any", label: tx({ id: "Semua", en: "All" }) },
                { value: "foreign", label: tx({ id: "Dana asing", en: "Foreign flow" }) },
                { value: "volume", label: "Volume" },
                { value: "return", label: tx({ id: "Gerak harga", en: "Price move" }) },
              ]}
            />
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            {kind === "any" && <T id="Saham yang tidak biasa di salah satu dari tiga hal: dana asing, volume, atau gerak harga." en="Stocks unusual in any of three things: foreign flow, volume, or price move." />}
            {kind === "foreign" && <T id="Investor asing membeli atau menjual jauh lebih besar dari biasanya. Sering menandakan institusi besar sedang bergerak." en="Foreign investors buying or selling far more than usual. Often a sign large institutions are moving." />}
            {kind === "volume" && <T id="Jumlah saham yang diperdagangkan jauh di atas (atau di bawah) biasanya. Lonjakan volume sering mendahului atau menyertai berita." en="Shares traded far above (or below) normal. Volume spikes often precede or accompany news." />}
            {kind === "return" && <T id="Harga naik atau turun jauh lebih besar dari gerak hariannya yang biasa." en="Price rose or fell far more than its usual daily move." />}
          </p>
        </div>
        <div>
          <div className="text-[14px] font-semibold">
            <T id="Seberapa tidak biasa minimal?" en="How unusual at least?" />
          </div>
          <div className="mt-3">
            <Segmented<Level>
              label={tx({ id: "Tingkat", en: "Level" })}
              value={min}
              onChange={setMin}
              options={([2, 3, 4] as Level[]).map((l) => ({ value: l, label: tx(LEVELS[l].label) }))}
            />
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            <T id="Menampilkan saham yang kejadiannya hari ini setidaknya" en="Shows stocks whose event today is at least" /> <span className="text-ink-2">“{tx(LEVELS[min].label).toLowerCase()}”</span>: {tx(LEVELS[min].rarity)}.{" "}
            <T id="Pilih tingkat lebih rendah untuk melihat lebih banyak saham, lebih tinggi untuk hanya kejadian paling menonjol." en="Choose a lower level to see more stocks, higher for only the most striking events." />
          </p>
        </div>
      </section>

      <h2 className="mt-6 text-lg font-semibold">
        {rows.length} <T id="saham" en="stocks" />
      </h2>

      <div className="mt-3 hidden md:block">
        <table className="w-full border-separate border-spacing-0 text-[13.5px]">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-3 pr-4 font-normal"><T id="Saham" en="Stock" /></th>
              <th className="py-3 pr-4 text-right font-normal"><T id="Harga" en="Price" /></th>
              <th className="py-3 pr-4 text-right font-normal"><T id="Dana asing" en="Foreign flow" /></th>
              <th className="py-3 pr-4 text-right font-normal">Volume</th>
              <th className="py-3 pr-4 text-right font-normal"><T id="Gerak harga" en="Price move" /></th>
              <th className="py-3 pr-2 text-right font-normal"><T id="Penilaian Arus" en="Arus verdict" /></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.symbol} className="hover:bg-surface">
                <td className="border-t border-line py-3 pr-4">
                  <Link href={`/saham/${r.symbol}/`} className="font-semibold text-ink hover:text-arus">{r.symbol}</Link>
                  <div className="max-w-60 truncate text-xs text-muted">{r.name}</div>
                </td>
                <td className="num border-t border-line py-3 pr-4 text-right text-ink-2">{price(r.price, lang)}</td>
                <td className="border-t border-line py-3 pr-4 text-right">{cell(r, "foreign")}</td>
                <td className="border-t border-line py-3 pr-4 text-right">{cell(r, "volume")}</td>
                <td className="border-t border-line py-3 pr-4 text-right">{cell(r, "return")}</td>
                <td className="border-t border-line py-3 pr-2 text-right">
                  <VerdictBadge v={verdictOf(get(r, horizon).q)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-3 divide-y divide-line md:hidden">
        {rows.map((r) => (
          <li key={r.symbol}>
            <Link href={`/saham/${r.symbol}/`} className="block py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{r.symbol}</span>
                <VerdictBadge v={verdictOf(get(r, horizon).q)} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
                {(["foreign", "volume", "return"] as const).map((k) =>
                  level(z(r, k)) ? (
                    <span key={k} className={(z(r, k) ?? 0) > 0 ? "text-[#9cc5f5]" : "text-[#f0a3a3]"}>
                      {tx((z(r, k) ?? 0) > 0 ? WHAT[k].up : WHAT[k].down)}
                    </span>
                  ) : null,
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {rows.length === 0 && (
        <p className="py-14 text-center text-[14px] text-muted">
          <T id="Hari ini tidak ada saham yang setidak biasa ini. Coba pilih tingkat yang lebih rendah." en="No stock is this unusual today. Try a lower level." />
        </p>
      )}
      <p className="mt-8 max-w-[70ch] text-[13px] leading-relaxed text-muted">
        <T
          id="Kejadian tidak biasa bukan sinyal beli atau jual. Ia penanda bahwa ada sesuatu yang sedang terjadi, misalnya berita, aksi korporasi, atau institusi yang masuk-keluar. Cek beritanya sebelum mengambil kesimpulan."
          en="An unusual event is not a buy or sell signal. It marks that something is happening, such as news, a corporate action, or institutions moving in or out. Check the news before concluding anything."
        />
      </p>
    </div>
  );
}

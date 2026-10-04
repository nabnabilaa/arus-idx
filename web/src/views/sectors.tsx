"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Heatmap, SectorMap } from "@/components/charts/analytics";
import { ChartTitle } from "@/components/charts/kit";
import { Term } from "@/components/term";
import { SUBSECTOR_ID } from "@/lib/features";
import { idr, pct, signed } from "@/lib/format";
import { T, useLang } from "@/lib/i18n";
import type { Bundle } from "@/lib/types";

export function SectorsView({ sectors, sectorTs }: Pick<Bundle, "sectors" | "sectorTs">) {
  const { tx, lang } = useLang();
  const label = (s: string) => (lang === "id" ? SUBSECTOR_ID[s] ?? s : s);
  const rows = sectors.filter((s) => s.rs_20 != null && s.foreign_intensity_20 != null);
  const dates = Array.from(new Set(sectorTs.map((d) => d.date))).sort();
  const subs = [...rows].sort((a, b) => (b.rs_20 ?? 0) - (a.rs_20 ?? 0)).map((s) => s.sub_sector);
  const lookup = new Map(sectorTs.map((d) => [`${d.sub_sector}|${d.date}`, d.rs_20]));
  const values = subs.map((s) => dates.map((d) => lookup.get(`${s}|${d}`) ?? null));
  const leaders = rows.filter((r) => (r.rs_20 ?? 0) > 0 && (r.foreign_intensity_20 ?? 0) > 0);

  return (
    <div className="pt-12">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }} className="max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
          <T id="Ke mana arus uang mengalir" en="Where the money is flowing" />
        </h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-2">
          <T
            id="Dua pertanyaan untuk setiap subsektor: apakah sedang mengalahkan pasar, dan apakah investor asing sedang masuk? Jawaban keduanya ya adalah tempat angin sedang bertiup."
            en="Two questions for every sub-sector: is it beating the market, and are foreign investors moving in? Where both answers are yes, the wind is blowing."
          />
        </p>
        {leaders.length > 0 && (
          <p className="mt-4 text-[14px] text-muted">
            <T id="Saat ini memimpin dan dibeli asing:" en="Currently leading and foreign-bought:" />{" "}
            <span className="text-ink">{leaders.map((l) => label(l.sub_sector)).join(", ")}</span>
          </p>
        )}
      </motion.header>

      <section className="mt-12">
        <ChartTitle
          note={
            <>
              <Term k="relativeStrength">
                <T id="Kekuatan relatif" en="Relative strength" />
              </Term>{" "}
              <T id="(sumbu datar) vs intensitas" en="(horizontal) vs" />{" "}
              <Term k="foreignFlow">
                <T id="arus asing" en="foreign flow intensity" />
              </Term>{" "}
              <T id="(sumbu tegak), 20 hari. Ukuran gelembung = jumlah saham." en="(vertical), 20 days. Bubble size = number of stocks." />
            </>
          }
        >
          <T id="Peta rotasi sektor" en="Sector rotation map" />
        </ChartTitle>
        <SectorMap
          label={label}
          rows={rows.map((r) => ({
            key: r.sub_sector,
            x: r.rs_20 as number,
            y: r.foreign_intensity_20 as number,
            n: r.n,
            note: `${r.n} ${tx({ id: "saham", en: "stocks" })} · ${tx({ id: "teratas", en: "top" })}: ${r.top_pick ?? "–"}`,
          }))}
        />
      </section>

      {dates.length > 0 && (
        <section className="mt-16">
          <ChartTitle note={tx({ id: "Kekuatan relatif mingguan tiap subsektor. Biru = mengalahkan IHSG, merah = tertinggal. Baca dari kiri ke kanan untuk melihat rotasi.", en: "Weekly relative strength per sub-sector. Blue = beating IHSG, red = lagging. Read left to right to see rotation." })}>
            <T id="Rotasi dari minggu ke minggu" en="Rotation week by week" />
          </ChartTitle>
          <Heatmap rows={subs} cols={dates} values={values} label={label} />
        </section>
      )}

      <section className="mt-16 overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-3 pr-4 font-normal"><T id="Subsektor" en="Sub-sector" /></th>
              <th className="py-3 pr-4 text-right font-normal"><T id="Saham" en="Stocks" /></th>
              <th className="py-3 pr-4 text-right font-normal">RS 20h</th>
              <th className="py-3 pr-4 text-right font-normal">RS 60h</th>
              <th className="py-3 pr-4 text-right font-normal"><T id="Net asing 20h" en="Foreign net 20d" /></th>
              <th className="py-3 pr-4 text-right font-normal"><T id="Rata2 probabilitas" en="Avg probability" /></th>
              <th className="py-3 pr-4 font-normal"><T id="Teratas" en="Top pick" /></th>
            </tr>
          </thead>
          <tbody>
            {[...sectors].sort((a, b) => (b.rs_20 ?? -9) - (a.rs_20 ?? -9)).map((s) => (
              <tr key={s.sub_sector} className="hover:bg-surface">
                <td className="border-t border-line py-3 pr-4 text-ink">{label(s.sub_sector)}</td>
                <td className="num border-t border-line py-3 pr-4 text-right text-ink-2">{s.n}</td>
                <td className={`num border-t border-line py-3 pr-4 text-right ${(s.rs_20 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{signed(s.rs_20 != null ? s.rs_20 * 100 : null, 1, "%")}</td>
                <td className={`num border-t border-line py-3 pr-4 text-right ${(s.rs_60 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{signed(s.rs_60 != null ? s.rs_60 * 100 : null, 1, "%")}</td>
                <td className={`num border-t border-line py-3 pr-4 text-right ${(s.foreign_net_20 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{idr(s.foreign_net_20, lang)}</td>
                <td className="num border-t border-line py-3 pr-4 text-right text-ink">{Math.round((s.avg_conf_20 ?? 0.5) * 100)}</td>
                <td className="border-t border-line py-3 pr-4">
                  {s.top_pick && (
                    <Link href={`/saham/${s.top_pick}/`} className="font-medium text-arus hover:underline">
                      {s.top_pick}
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

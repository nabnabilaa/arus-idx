import { agendaBook } from "@/lib/agenda";
import { insiderBook } from "@/lib/insider";
import { weeklyRecap } from "@/lib/weekly";
import { bundle } from "@/lib/data";
import type { Stock } from "@/lib/types";
import { HomeView } from "@/views/home";

/** Only the columns the home page reads, so its HTML stays light (the full rows carry 100+ fields). */
const KEEP = [
  "symbol", "name", "sector", "sub_sector", "price", "market_cap", "ret_1", "ret_20", "q_1", "conf_1", "ci_lo_1", "ci_hi_1",
  "sharia", "suspended_recent", "risk_flags", "turnover_med_20", "ff_net_20", "ff_today", "vol_mult", "z_foreign", "z_volume", "z_return",
  "fin_grade", "fin_score", "fin_n", "rev_cagr", "tier",
] as const;

export default function Page() {
  const ranking = bundle.ranking.map((s) => Object.fromEntries(KEEP.map((k) => [k, (s as unknown as Record<string, unknown>)[k] ?? null]))) as unknown as Stock[];
  const slim = (k: "1" | "20") => ({ coefficients: bundle.models[k].coefficients, metrics: bundle.models[k].metrics }) as unknown as (typeof bundle.models)["1"];
  const week = agendaBook.upcoming.filter((it) => it.date <= new Date(new Date(bundle.meta.as_of).getTime() + 10 * 864e5).toISOString().slice(0, 10));
  return (
    <HomeView
      ranking={ranking}
      meta={bundle.meta}
      market={bundle.market}
      models={{ "1": slim("1"), "20": slim("20") }}
      sectors={bundle.sectors}
      agenda={week}
      explore={{
        unusual: bundle.ranking.filter((s) => Math.max(Math.abs(s.z_foreign ?? 0), Math.abs(s.z_volume ?? 0), Math.abs(s.z_return ?? 0)) >= 3).length,
        chains: insiderBook.chains.length,
        agendaWeek: week.length,
        ihsgWeek: weeklyRecap.stats?.ihsg ?? null,
        foreignWeek: weeklyRecap.stats?.foreign ?? null,
        proofFolds: `${bundle.models["1"].metrics.folds_beating_chance}/${bundle.models["1"].metrics.n_folds}`,
        stocks: bundle.ranking.length,
      }}
      macro={{
        recent: bundle.macro.recent,
        series: Object.fromEntries(Object.entries(bundle.macro.series).map(([k, v]) => [k, { date: v.date.slice(-40), v: v.v.slice(-40) }])) as typeof bundle.macro.series,
        commodities: bundle.macro.commodities,
      }}
    />
  );
}

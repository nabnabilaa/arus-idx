import { bundle, series } from "./data";
import type { CompactStock } from "./types";

/**
 * One small row per stock for client pages that need many stocks at once (watchlist, compare,
 * search). Built on the server so the full data bundle never reaches the browser.
 */
export function compactStocks(): CompactStock[] {
  return bundle.ranking.map((r) => {
    const sum = bundle.brokerSummary?.[r.symbol]?.["5"];
    const tilt = sum && sum.top5_buy + sum.top5_sell > 0 ? (sum.top5_buy - sum.top5_sell) / (sum.top5_buy + sum.top5_sell) : null;
    const cone = bundle.cones?.[r.symbol];
    const c = series[r.symbol]?.c ?? [];
    return {
      symbol: r.symbol, name: r.name, sector: r.sector, sub_sector: r.sub_sector, tier: r.tier ?? "full",
      price: r.price, ret_1: r.ret_1, ret_20: r.ret_20, q_1: r.q_1, conf_1: r.conf_1,
      fin_grade: r.fin_grade ?? null, fin_score: r.fin_score ?? null, fin_n: r.fin_n ?? null, rev_cagr: r.rev_cagr ?? null,
      pe_ttm: r.pe_ttm, pb_mrq: r.pb_mrq, yield_ttm: r.yield_ttm, roe_ttm: r.roe_ttm, market_cap: r.market_cap,
      ff_net_20: r.ff_net_20, ff_today: r.ff_today ?? null, vol_mult: r.vol_mult ?? null,
      z_foreign: r.z_foreign, z_volume: r.z_volume, z_return: r.z_return,
      invalidate: r.invalidate, support_20: r.support_20, resistance_20: r.resistance_20, atr_pct: r.atr_pct,
      tilt5: tilt, sharia: r.sharia,
      week: cone?.["1"]?.at(-1) ? [cone["1"].at(-1)!.lo, cone["1"].at(-1)!.hi] : null,
      month: cone?.["20"]?.at(-1) ? [cone["20"].at(-1)!.lo, cone["20"].at(-1)!.hi] : null,
      closes: c.slice(-60).map((x) => Math.round(x * 100) / 100),
    };
  });
}

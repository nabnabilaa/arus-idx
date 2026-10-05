import { notFound } from "next/navigation";
import { bundle, series } from "@/lib/data";
import { agendaBook } from "@/lib/agenda";
import { chainCard, N_CHAIN_CARDS } from "@/lib/cards";
import { insiderBook } from "@/lib/insider";
import { StockView } from "@/views/stock";

export function generateStaticParams() {
  return bundle.ranking.map((r) => ({ symbol: r.symbol }));
}

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const s = bundle.ranking.find((r) => r.symbol === symbol);
  if (!s) return { title: "Arus" };
  const title = `${s.symbol} · ${s.name ?? ""} · Arus`;
  const description = `${s.symbol} ${s.price?.toLocaleString("id-ID")} (${(s.ret_1 ?? 0) >= 0 ? "+" : ""}${((s.ret_1 ?? 0) * 100).toFixed(2)}%). Bandar, kesehatan keuangan, rentang wajar, dan rencana trade di Arus.`;
  return { title, description, openGraph: { title, description }, twitter: { title, description } };
}

export default async function Page({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const stock = bundle.ranking.find((r) => r.symbol === symbol);
  if (!stock) notFound();
  const cal = { 1: bundle.models["1"].calibration, 20: bundle.models["20"].calibration };
  const weights = {
    1: Object.fromEntries(bundle.models["1"].coefficients.map((c) => [c.feature, c.weight])),
    20: Object.fromEntries(bundle.models["20"].coefficients.map((c) => [c.feature, c.weight])),
  };
  return (
    <StockView
      stock={stock}
      candles={series[symbol] ?? null}
      broker={bundle.brokers[symbol] ?? null}
      bandar={bundle.bandar?.[symbol] ?? null}
      macro={bundle.macro}
      cal={cal}
      weights={weights}
      families={bundle.families}
      total={bundle.ranking.length}
      ihsg={bundle.market.map((m) => ({ date: m.date, v: m.ihsg }))}
      cone={bundle.cones?.[symbol] ? { 1: bundle.cones[symbol]["1"] ?? [], 20: bundle.cones[symbol]["20"] ?? [] } : null}
      coneCoverage={bundle.coneCoverage ?? null}
      peers={bundle.ranking
        .filter((r) => r.sub_sector === stock.sub_sector && r.symbol !== symbol)
        .slice(0, 8)
        .map((r) => ({ symbol: r.symbol, name: r.name, fin_grade: r.fin_grade, fin_score: r.fin_score, fin_n: r.fin_n, pct_value: r.pct_value, rev_cagr: r.rev_cagr }))}
      fin={bundle.financials?.[symbol] ?? null}
      profile={bundle.brokerProfiles?.[symbol] ?? null}
      summary={bundle.brokerSummary?.[symbol] ?? null}
      news={bundle.news?.[symbol] ?? []}
      asOf={bundle.meta.as_of}
      valPeers={bundle.ranking
        .filter((r) => r.sector === stock.sector && r.symbol !== symbol && r.pb_mrq != null && r.pb_mrq > 0 && r.roe_ttm != null)
        .map((r) => ({ symbol: r.symbol, pb: r.pb_mrq as number, roe: r.roe_ttm as number, sub: r.sub_sector === stock.sub_sector }))}
      agenda={{ items: agendaBook.upcoming.filter((it) => it.s === symbol), history: agendaBook.history[symbol] ?? [] }}
      insider={{
        events: insiderBook.events.filter((e) => e.s === symbol),
        chains: insiderBook.chains.filter((c) => c.s === symbol),
        paths: insiderBook.paths[symbol] ? { [symbol]: insiderBook.paths[symbol] } : {},
        ksei: insiderBook.ksei,
        cards: insiderBook.chains.slice(0, N_CHAIN_CARDS).filter((c) => c.s === symbol).map(chainCard),
      }}
    />
  );
}

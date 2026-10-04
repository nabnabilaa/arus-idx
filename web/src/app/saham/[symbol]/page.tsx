import { notFound } from "next/navigation";
import { bundle, series } from "@/lib/data";
import { StockView } from "@/views/stock";

export function generateStaticParams() {
  return bundle.ranking.map((r) => ({ symbol: r.symbol }));
}

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const s = bundle.ranking.find((r) => r.symbol === symbol);
  return { title: s ? `${s.symbol} · ${s.name ?? ""} · Arus` : "Arus" };
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
      cal={cal}
      weights={weights}
      families={bundle.families}
      total={bundle.ranking.length}
      peers={bundle.ranking
        .filter((r) => r.sub_sector === stock.sub_sector && r.symbol !== symbol)
        .slice(0, 8)
        .map((r) => ({ symbol: r.symbol, name: r.name, q_1: r.q_1, q_20: r.q_20, conf_1: r.conf_1, conf_20: r.conf_20 }))}
    />
  );
}

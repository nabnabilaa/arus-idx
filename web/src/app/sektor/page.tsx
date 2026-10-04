import { bundle } from "@/lib/data";
import { SectorsView } from "@/views/sectors";

export const metadata = { title: "Arus sektor · Arus" };

export default function Page() {
  const stocks = bundle.ranking.map((r) => ({
    symbol: r.symbol, name: r.name, sub_sector: r.sub_sector, price: r.price, ret_1: r.ret_1, ret_20: r.ret_20, ff_net_20: r.ff_net_20, fin_grade: r.fin_grade ?? null,
  }));
  return <SectorsView sectors={bundle.sectors} sectorTs={bundle.sectorTs} stocks={stocks} />;
}

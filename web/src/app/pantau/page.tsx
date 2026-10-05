import { compactStocks } from "@/lib/compact";
import { bundle } from "@/lib/data";
import { WatchView } from "@/views/watch";

export const metadata = { title: "Pantauanku · Arus" };

export default function Page() {
  return <WatchView stocks={compactStocks()} asOf={bundle.meta.as_of} total={bundle.ranking.length} />;
}

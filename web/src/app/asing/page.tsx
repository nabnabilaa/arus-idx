import { bundle } from "@/lib/data";
import { FlowsView } from "@/views/flows";

export const metadata = { title: "Asing & bandar · Arus" };

export default function Page() {
  return <FlowsView market={bundle.market} brokers={bundle.brokers} ranking={bundle.ranking} bandar={bundle.bandar} summary={bundle.brokerSummary} news={bundle.newsLatest} />;
}

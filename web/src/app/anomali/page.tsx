import { bundle } from "@/lib/data";
import { AnomaliesView } from "@/views/anomalies";

export const metadata = { title: "Anomali · Arus" };

export default function Page() {
  return <AnomaliesView ranking={bundle.ranking} history={bundle.anomalyHistory} />;
}

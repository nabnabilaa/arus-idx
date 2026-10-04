import { bundle } from "@/lib/data";
import { HonestyView } from "@/views/honesty";

export const metadata = { title: "Bukti · Arus" };

export default function Page() {
  return <HonestyView meta={bundle.meta} models={bundle.models} coneCoverage={bundle.coneCoverage} anomalyHistory={bundle.anomalyHistory} />;
}

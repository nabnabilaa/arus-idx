import { bundle } from "./data";
import { dateLabel } from "./format";

/** The broker-data window, for page copy (server side only: it reads the full bundle). */
export function brokerPeriod() {
  const s = Object.values(bundle.brokerSummary ?? {})[0]?.all;
  return s ? `${dateLabel(s.from, "id")} – ${dateLabel(s.to, "id")}` : "";
}

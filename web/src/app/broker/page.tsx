import brokersJson from "@/data/brokers.json";
import { brokerPeriod } from "@/lib/broker-period";
import type { BrokerIndex } from "@/lib/types";
import { BrokerDirectory, type DirectoryRow } from "@/views/broker";

export const metadata = { title: "Broker · Arus" };

const brokers = brokersJson as unknown as BrokerIndex;

export default function Page() {
  const rows: DirectoryRow[] = Object.entries(brokers)
    .map(([code, b]) => {
      const byNet = [...b.stocks].sort((a, z) => z.net - a.net);
      return {
        code, name: b.name, cohort: b.cohort, foreign: b.foreign, gross: b.gross, net: b.net, n_stocks: b.n_stocks,
        acc: byNet.filter((x) => x.net > 0).slice(0, 3).map((x) => ({ s: x.s, net: x.net })),
        dist: byNet.filter((x) => x.net < 0).reverse().slice(0, 3).map((x) => ({ s: x.s, net: x.net })),
      };
    })
    .sort((a, z) => z.gross - a.gross);
  return <BrokerDirectory rows={rows} period={brokerPeriod()} />;
}


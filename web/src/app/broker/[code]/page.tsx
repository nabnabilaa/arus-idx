import { notFound } from "next/navigation";
import brokersJson from "@/data/brokers.json";
import { bundle } from "@/lib/data";
import type { BrokerIndex } from "@/lib/types";
import { brokerPeriod } from "@/lib/broker-period";
import { BrokerDetail } from "@/views/broker";

const brokers = brokersJson as unknown as BrokerIndex;

export function generateStaticParams() {
  return Object.keys(brokers).map((code) => ({ code }));
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return { title: `${code} · ${brokers[code]?.name ?? "Broker"} · Arus` };
}

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const b = brokers[code];
  if (!b) notFound();
  const names = Object.fromEntries(bundle.ranking.map((r) => [r.symbol, r.name]));
  const prices = Object.fromEntries(bundle.ranking.map((r) => [r.symbol, r.price]));
  return <BrokerDetail b={{ ...b, code }} names={names} prices={prices} period={brokerPeriod()} />;
}

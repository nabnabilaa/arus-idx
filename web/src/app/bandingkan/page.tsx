import { compactStocks } from "@/lib/compact";
import { CompareView } from "@/views/compare";

export const metadata = { title: "Bandingkan saham · Arus" };

export default function Page() {
  return <CompareView stocks={compactStocks()} />;
}

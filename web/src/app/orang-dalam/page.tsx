import { bundle } from "@/lib/data";
import { insiderBook } from "@/lib/insider";
import { InsiderView } from "@/views/insider";

export const metadata = { title: "Orang dalam · Arus" };

export default function Page() {
  return <InsiderView book={insiderBook} ranked={bundle.ranking.map((r) => r.symbol)} />;
}

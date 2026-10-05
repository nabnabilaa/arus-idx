import { bundle } from "@/lib/data";
import { weeklyRecap } from "@/lib/weekly";
import { WeeklyView } from "@/views/weekly";

export const metadata = { title: "Rekap pekan · Arus" };

export default function Page() {
  return <WeeklyView w={weeklyRecap} ranked={bundle.ranking.map((r) => r.symbol)} />;
}

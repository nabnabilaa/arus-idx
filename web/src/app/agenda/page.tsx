import { agendaBook } from "@/lib/agenda";
import { bundle } from "@/lib/data";
import { AgendaView } from "@/views/agenda";

export const metadata = { title: "Agenda · Arus" };

export default function Page() {
  return <AgendaView book={agendaBook} ranked={bundle.ranking.map((r) => r.symbol)} />;
}

import agendaJson from "@/data/agenda.json";
import type { Bi } from "./i18n";
import type { AgendaBook, AgendaType } from "./types";

/** Corporate-action calendar and the ex-dividend study, from the Sectors calendar endpoint. */
export const agendaBook = agendaJson as unknown as AgendaBook;

export const AGENDA_LABEL: Record<AgendaType, { label: Bi; tone: string }> = {
  dividend: { label: { id: "Ex-dividen", en: "Ex-dividend" }, tone: "text-[#7fd4a8]" },
  agm: { label: { id: "RUPS", en: "AGM" }, tone: "text-arus" },
  right_issue: { label: { id: "Rights issue", en: "Rights issue" }, tone: "text-warn" },
  stock_split: { label: { id: "Stock split", en: "Stock split" }, tone: "text-[#c9a7ff]" },
  warrant: { label: { id: "Waran", en: "Warrant" }, tone: "text-ink-2" },
  bonus: { label: { id: "Saham bonus", en: "Bonus shares" }, tone: "text-ink-2" },
};

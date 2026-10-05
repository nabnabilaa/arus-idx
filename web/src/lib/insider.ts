import insiderJson from "@/data/insider.json";
import type { Bi } from "./i18n";
import type { InsiderBook } from "./types";

/** KSEI ownership filings, imported only by the pages that show them. */
export const insiderBook = insiderJson as unknown as InsiderBook;

export const HOLDER_KIND: Record<string, Bi> = {
  insider: { id: "Orang dalam", en: "Insider" },
  institution: { id: "Institusi", en: "Institution" },
  "corporate-investor": { id: "Korporasi", en: "Corporate" },
};

export const TAG_LABEL: Record<string, Bi> = {
  divestment: { id: "Pelepasan", en: "Divestment" },
  "repurchase-agreement": { id: "Repo (gadai)", en: "Repo (pledge)" },
  placement: { id: "Private placement", en: "Private placement" },
  free_float_compliance: { id: "Pemenuhan free float", en: "Free-float compliance" },
  "capital-restructuring": { id: "Restrukturisasi modal", en: "Capital restructuring" },
  takeover: { id: "Ambil alih", en: "Takeover" },
  mesop: { id: "Opsi saham karyawan", en: "Employee options" },
  bullish: { id: "Menambah", en: "Adding" },
};

/** "Saratoga Group" from "saratoga-group". */
export const groupName = (slug: string | null) =>
  slug ? slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : null;

export const filingDate = (ts: string) => ts.slice(0, 10);

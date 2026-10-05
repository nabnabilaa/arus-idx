import weeklyJson from "@/data/weekly.json";
import type { WeeklyRecap } from "./types";

/** The week's recap, computed by the pipeline from the IDX summary and the Sectors-derived books. */
export const weeklyRecap = weeklyJson as unknown as WeeklyRecap;

/** IDX sector names (Indonesian in the source) to English. */
export const IDX_SECTOR_EN: Record<string, string> = {
  "Barang Baku": "Basic Materials",
  "Barang Konsumen Non-Primer": "Consumer Cyclicals",
  "Barang Konsumen Primer": "Consumer Non-Cyclicals",
  Energi: "Energy",
  Infrastruktur: "Infrastructures",
  Kesehatan: "Healthcare",
  Keuangan: "Financials",
  Perindustrian: "Industrials",
  "Properti & Real Estat": "Properties & Real Estate",
  Teknologi: "Technology",
  "Transportasi & Logistik": "Transportation & Logistics",
};

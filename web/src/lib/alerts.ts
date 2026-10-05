import type { Bi } from "./i18n";
import type { CompactStock } from "./types";

export type Alert = { tone: "up" | "down" | "warn"; text: Bi };

const rp = (x: number) => `Rp${(Math.abs(x) / 1e9).toFixed(1).replace(".", ",")} M`;
const pc = (x: number | null) => `${(x ?? 0) >= 0 ? "+" : ""}${((x ?? 0) * 100).toFixed(1)}%`;

/** The same rules the Telegram agent uses for watchlist pings, from one day's snapshot. */
export function alertsFor(s: CompactStock): Alert[] {
  const out: Alert[] = [];
  const zf = s.z_foreign ?? 0, zv = s.z_volume ?? 0, zr = s.z_return ?? 0;
  if (Math.abs(zf) >= 3)
    out.push({
      tone: zf > 0 ? "up" : "down",
      text: zf > 0 ? { id: `Asing borong ${rp(s.ff_today ?? 0)}`, en: `Heavy foreign buying IDR ${(Math.abs(s.ff_today ?? 0) / 1e9).toFixed(1)}B` } : { id: `Asing jual besar ${rp(s.ff_today ?? 0)}`, en: `Heavy foreign selling IDR ${(Math.abs(s.ff_today ?? 0) / 1e9).toFixed(1)}B` },
    });
  if (zv >= 3) out.push({ tone: "warn", text: { id: `Volume melonjak ${(s.vol_mult ?? 0).toFixed(1)}×`, en: `Volume spike ${(s.vol_mult ?? 0).toFixed(1)}×` } });
  if (Math.abs(zr) >= 3) out.push({ tone: zr > 0 ? "up" : "down", text: { id: `Harga bergerak tajam ${pc(s.ret_1)}`, en: `Sharp price move ${pc(s.ret_1)}` } });
  const px = s.price ?? 0;
  if (s.invalidate && px < s.invalidate) out.push({ tone: "down", text: { id: "Di bawah batas sinyal batal", en: "Below the signal-void level" } });
  else if (s.support_20 && px < s.support_20) out.push({ tone: "down", text: { id: "Jebol batas bawah 1 bulan", en: "Broke the 1-month floor" } });
  if (s.resistance_20 && px > s.resistance_20) out.push({ tone: "up", text: { id: "Menembus batas atas 1 bulan", en: "Broke above the 1-month ceiling" } });
  return out;
}

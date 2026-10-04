import type { Bi } from "./i18n";
import type { Horizon, Stock } from "./types";

export type VerdictKey = "strong" | "edge" | "neutral" | "weak" | "caution";

/** Five plain-language levels from the stock's rank among all stocks today. */
export const VERDICT: Record<VerdictKey, { label: Bi; short: Bi; color: string; text: string; ring: string; bg: string; explain: Bi }> = {
  strong: {
    label: { id: "Sangat diunggulkan", en: "Strong edge" },
    short: { id: "Sangat unggul", en: "Strong" },
    color: "#5cc8ff",
    text: "text-arus",
    ring: "ring-arus/40",
    bg: "bg-arus/12",
    explain: { id: "Masuk 10% teratas hari ini. Kondisi seperti ini paling sering berakhir lebih baik dari saham lain.", en: "Top 10% today. This setup most often ended better than other stocks." },
  },
  edge: {
    label: { id: "Diunggulkan", en: "Edge" },
    short: { id: "Unggul", en: "Edge" },
    color: "#3987e5",
    text: "text-[#8fbcf3]",
    ring: "ring-up/40",
    bg: "bg-up/10",
    explain: { id: "Di atas rata-rata hari ini. Peluangnya sedikit lebih baik dari lempar koin.", en: "Above average today. Odds slightly better than a coin flip." },
  },
  neutral: {
    label: { id: "Netral", en: "Neutral" },
    short: { id: "Netral", en: "Neutral" },
    color: "#75839a",
    text: "text-ink-2",
    ring: "ring-line-strong",
    bg: "bg-raised",
    explain: { id: "Tidak ada keunggulan yang jelas. Arus tidak lebih yakin dari lempar koin.", en: "No clear edge. Arus is no surer than a coin flip." },
  },
  weak: {
    label: { id: "Kurang diunggulkan", en: "Weak" },
    short: { id: "Kurang", en: "Weak" },
    color: "#e6a067",
    text: "text-[#f0bf94]",
    ring: "ring-[#e6a067]/40",
    bg: "bg-[#e6a067]/10",
    explain: { id: "Di bawah rata-rata hari ini. Kondisi seperti ini lebih sering tertinggal.", en: "Below average today. This setup more often lagged." },
  },
  caution: {
    label: { id: "Waspada", en: "Caution" },
    short: { id: "Waspada", en: "Caution" },
    color: "#e66767",
    text: "text-[#f0a3a3]",
    ring: "ring-down/40",
    bg: "bg-down/10",
    explain: { id: "Masuk 10% terbawah hari ini. Secara historis kelompok inilah yang paling sering tertinggal; di sini bukti Arus paling kuat.", en: "Bottom 10% today. Historically this group lagged most often; this is where Arus' evidence is strongest." },
  },
};

export const VERDICT_ORDER: VerdictKey[] = ["strong", "edge", "neutral", "weak", "caution"];

export function verdictOf(q: number | null | undefined): VerdictKey {
  const v = q ?? 0.5;
  if (v >= 0.9) return "strong";
  if (v >= 0.7) return "edge";
  if (v > 0.3) return "neutral";
  if (v > 0.1) return "weak";
  return "caution";
}

export const HORIZON_LABEL: Record<Horizon, { name: Bi; long: Bi; who: Bi }> = {
  1: {
    name: { id: "Besok", en: "Next day" },
    long: { id: "dalam 1 hari bursa ke depan", en: "over the next trading day" },
    who: { id: "untuk trader harian", en: "for day traders" },
  },
  20: {
    name: { id: "1 bulan", en: "1 month" },
    long: { id: "dalam ±1 bulan (20 hari bursa)", en: "over ~1 month (20 trading days)" },
    who: { id: "untuk swing & investor", en: "for swing traders & investors" },
  },
};

export function get(s: Stock, h: Horizon) {
  const k = <T extends string>(base: T) => `${base}_${h}` as const;
  const r = s as unknown as Record<string, unknown>;
  return {
    conf: (r[k("conf")] as number) ?? 0.5,
    q: (r[k("q")] as number) ?? 0.5,
    lift: (r[k("lift")] as number) ?? 0,
    lo: r[k("ci_lo")] as number | null,
    hi: r[k("ci_hi")] as number | null,
    n: (r[k("analog_n")] as number) ?? 0,
    nEff: (r[k("analog_n_eff")] as number) ?? 0,
    excess: r[k("analog_excess")] as number | null,
    p25: r[k("analog_excess_p25")] as number | null,
    p75: r[k("analog_excess_p75")] as number | null,
    beatIhsg: r[k("analog_beat_ihsg")] as number | null,
    pos: ((r[k("drivers_pos")] as string[]) ?? []) as import("./types").FeatureKey[],
    neg: ((r[k("drivers_neg")] as string[]) ?? []) as import("./types").FeatureKey[],
    contrib: (f: string) => (r[`c${h}_${f}`] as number) ?? 0,
  };
}

/** "56 dari 100" — natural frequencies read far easier than percentages. */
export function outOf100(p: number | null | undefined) {
  return p == null ? "–" : String(Math.round(p * 100));
}

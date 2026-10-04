import type { Lang } from "./i18n";

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

export function pct(x: number | null | undefined, digits = 0) {
  return isNum(x) ? `${(x * 100).toFixed(digits)}%` : "–";
}

export function signed(x: number | null | undefined, digits = 1, suffix = "") {
  if (!isNum(x)) return "–";
  const s = x.toFixed(digits);
  return `${x > 0 ? "+" : ""}${s}${suffix}`;
}

/** Compact IDR: Rp1,2 T / Rp340 M / Rp12 jt (id) · IDR 1.2T / 340B / 12M (en). */
export function idr(x: number | null | undefined, lang: Lang = "id") {
  if (!isNum(x)) return "–";
  const a = Math.abs(x);
  const sign = x < 0 ? "−" : "";
  const fmt = (v: number, d: number) =>
    v.toLocaleString(lang === "id" ? "id-ID" : "en-US", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
  const units =
    lang === "id"
      ? [
          [1e12, " T"],
          [1e9, " M"],
          [1e6, " jt"],
        ]
      : [
          [1e12, "T"],
          [1e9, "B"],
          [1e6, "M"],
        ];
  for (const [base, u] of units as [number, string][]) {
    if (a >= base) return `${sign}${lang === "id" ? "Rp" : "IDR "}${fmt(a / base, a / base >= 100 ? 0 : 1)}${u}`;
  }
  return `${sign}${lang === "id" ? "Rp" : "IDR "}${fmt(a, 0)}`;
}

export function price(x: number | null | undefined, lang: Lang = "id") {
  if (!isNum(x)) return "–";
  return x.toLocaleString(lang === "id" ? "id-ID" : "en-US", { maximumFractionDigits: 0 });
}

export function dateLabel(d: string, lang: Lang = "id", opts: Intl.DateTimeFormatOptions = {}) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString(lang === "id" ? "id-ID" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...opts,
  });
}

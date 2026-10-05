import type { Bi } from "./i18n";

export type RiskFlag = "watch_board" | "cooling_down" | "suspended" | "insider_selling" | "dilution" | "pump_like" | "acceleration_board";

/** Fact-based risk markers (not model output): short label for badges, a sentence for the risk list. */
export const RISK: Record<RiskFlag, { label: Bi; why: Bi }> = {
  watch_board: {
    label: { id: "Papan pemantauan khusus", en: "Special watch board" },
    why: {
      id: "Bursa menempatkan saham ini di papan pemantauan khusus (misalnya karena kinerja atau likuiditas). Perdagangannya memakai lelang berkala dan risikonya lebih tinggi.",
      en: "The exchange keeps this stock on its special watch board (e.g. for weak results or liquidity). It trades by periodic call auction and carries higher risk.",
    },
  },
  cooling_down: {
    label: { id: "Baru di-cooling down", en: "Recent cooling-down" },
    why: {
      id: "Bursa menghentikan sementara saham ini dalam 90 hari terakhir karena kenaikan harga kumulatif yang signifikan. Kenaikan seperti itu rawan berbalik.",
      en: "The exchange halted this stock within 90 days after a significant cumulative price rise. Run-ups like that are prone to reversing.",
    },
  },
  suspended: {
    label: { id: "Pernah disuspensi 90h", en: "Suspended within 90d" },
    why: {
      id: "Saham ini pernah disuspensi bursa dalam 90 hari terakhir. Risiko likuiditas dan regulasinya lebih tinggi.",
      en: "This stock was suspended by the exchange within 90 days. Liquidity and regulatory risk are higher.",
    },
  },
  insider_selling: {
    label: { id: "Orang dalam menjual", en: "Insiders selling" },
    why: {
      id: "Orang dalam lebih banyak menjual daripada membeli di pasar dalam 90 hari terakhir (lebih dari Rp1 miliar bersih, tanpa menghitung repo atau private placement).",
      en: "Insiders sold more than they bought on the market over 90 days (over IDR 1B net, excluding repo pledges and placements).",
    },
  },
  dilution: {
    label: { id: "Rights issue mengencerkan", en: "Dilutive rights issue" },
    why: {
      id: "Ada rights issue di depan yang bisa mengencerkan kepemilikan 20% atau lebih bagi yang tidak ikut menebus.",
      en: "A rights issue ahead can dilute non-subscribers by 20% or more.",
    },
  },
  pump_like: {
    label: { id: "Pola mirip pompom", en: "Pump-like days" },
    why: {
      id: "Ada hari ketika harga naik lebih dari 3% dengan volume lebih dari 2× biasanya, sementara broker ritel membeli dan institusi menjual.",
      en: "There were days when the price rose over 3% on more than 2× normal volume while retail brokers bought and institutions sold.",
    },
  },
  acceleration_board: {
    label: { id: "Papan akselerasi", en: "Acceleration board" },
    why: {
      id: "Tercatat di papan akselerasi untuk perusahaan kecil atau tahap awal. Fluktuasi dan risiko likuiditasnya biasanya lebih besar.",
      en: "Listed on the acceleration board for small or early-stage companies. Swings and liquidity risk are usually larger.",
    },
  },
};

export const riskFlags = (flags: string[] | null | undefined): RiskFlag[] => (flags ?? []).filter((f): f is RiskFlag => f in RISK);

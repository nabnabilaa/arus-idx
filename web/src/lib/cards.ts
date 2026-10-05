/** File names of the share cards rendered at build time under /kartu/ (pure helpers, no data imports). */

export const ANOMALY_Z = 3;
export const N_CHAIN_CARDS = 30;

export const anomalyCard = (symbol: string) => `tak-biasa-${symbol}.png`;

/** A short stable hash of the holder name keeps chain card names readable and unique. */
export const chainCard = (c: { s: string; side: string; holder: string }) => {
  let h = 0;
  for (const ch of c.holder) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `orang-dalam-${c.s}-${c.side}-${h.toString(36)}.png`;
};

export const WEEKLY_CARD = "rekap-pekan.png";

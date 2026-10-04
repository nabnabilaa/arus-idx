import { FEATURE } from "./features";
import type { Bi } from "./i18n";
import type { Broker, FeatureKey, Horizon, Stock } from "./types";
import { get, HORIZON_LABEL, verdictOf } from "./verdict";

/** One plain sentence on what the score means for this stock. */
export function headline(s: Stock, h: Horizon): Bi {
  const g = get(s, h);
  const n = Math.round(g.conf * 100);
  const when = HORIZON_LABEL[h].long;
  const v = verdictOf(g.q);
  if (v === "neutral")
    return {
      id: `Untuk ${s.symbol}, Arus tidak melihat keunggulan yang jelas ${when.id}: ${n} dari 100, hampir sama dengan lempar koin. Itu jawaban jujur, bukan kegagalan.`,
      en: `For ${s.symbol}, Arus sees no clear edge ${when.en}: ${n} out of 100, close to a coin flip. That's an honest answer, not a failure.`,
    };
  if (v === "strong" || v === "edge")
    return {
      id: `Dari 100 kondisi di masa lalu yang mirip ${s.symbol} hari ini, ${n} bergerak lebih baik daripada separuh saham lain ${when.id}.`,
      en: `Of 100 past situations that looked like ${s.symbol} today, ${n} did better than half of all other stocks ${when.en}.`,
    };
  return {
    id: `Dari 100 kondisi di masa lalu yang mirip ${s.symbol} hari ini, hanya ${n} yang bergerak lebih baik daripada separuh saham lain ${when.id}. Lebih sering tertinggal.`,
    en: `Of 100 past situations that looked like ${s.symbol} today, only ${n} did better than half of all other stocks ${when.en}. It lagged more often.`,
  };
}

/** Why a signal pushes the score, in words, from the learned weight direction. */
export function reasonMeaning(k: FeatureKey, weight: number, pctl: number | null): Bi {
  const prefersHigh = weight >= 0;
  const state = (pctl ?? 0.5) >= 0.5 ? FEATURE[k].hi : FEATURE[k].lo;
  const liked = prefersHigh ? FEATURE[k].hi : FEATURE[k].lo;
  const helps = ((pctl ?? 0.5) >= 0.5) === prefersHigh;
  return helps
    ? {
        id: `${state.id}. Di data setahun terakhir, saham dengan kondisi “${liked.id.toLowerCase()}” lebih sering unggul.`,
        en: `${state.en}. Over the past year, stocks showing “${liked.en.toLowerCase()}” won more often.`,
      }
    : {
        id: `${state.id}. Di data setahun terakhir, yang lebih sering unggul justru saham dengan kondisi “${liked.id.toLowerCase()}”.`,
        en: `${state.en}. Over the past year, the stocks that won more often showed “${liked.en.toLowerCase()}” instead.`,
      };
}

/** What could invalidate the picture — drawn from the stock's own data. */
export function risks(s: Stock, broker?: Broker | null): Bi[] {
  const out: Bi[] = [];
  if (broker?.tone === "neg")
    out.push({
      id: "Jejak broker menunjukkan institusi sedang keluar sementara ritel menampung. Pola ini sering mendahului penurunan.",
      en: "The broker footprint shows institutions exiting while retail absorbs. This pattern often precedes declines.",
    });
  if (s.suspended_recent)
    out.push({
      id: "Saham ini pernah disuspensi bursa dalam 90 hari terakhir. Risiko likuiditas dan regulasinya lebih tinggi.",
      en: "This stock was suspended by the exchange within 90 days. Liquidity and regulatory risk are higher.",
    });
  if ((s.volatility_20 ?? 0) > 0.85)
    out.push({
      id: "Pergerakannya termasuk paling liar (15% teratas). Naik-turun besar dalam sehari adalah hal biasa di sini.",
      en: "Among the most volatile (top 15%). Big swings within a day are normal here.",
    });
  if ((s.z_return ?? 0) > 3)
    out.push({
      id: "Harga melonjak tidak biasa hari ini. Lonjakan mendadak lebih rawan berbalik.",
      en: "Price jumped unusually today. Sudden spikes are more prone to reversing.",
    });
  if ((s.pos_52w ?? 0) > 0.95)
    out.push({
      id: "Harga di puncak setahun. Aksi ambil untung bisa memicu koreksi tajam.",
      en: "Price is at its one-year high. Profit-taking can trigger a sharp pullback.",
    });
  if ((s.insider_sells ?? 0) > (s.insider_buys ?? 0))
    out.push({
      id: "Orang dalam perusahaan lebih banyak melapor menjual daripada membeli dalam 90 hari terakhir.",
      en: "Company insiders reported more sales than purchases over the last 90 days.",
    });
  if ((s.ff_net_5 ?? 0) < 0 && (s.ff_net_20 ?? 0) > 0)
    out.push({
      id: "Asing membeli sebulan terakhir, tapi minggu ini mulai menjual. Perhatikan apakah berlanjut.",
      en: "Foreigners bought over the month but started selling this week. Watch whether it continues.",
    });
  out.push({
    id: "Skor tidak menghitung biaya transaksi, dan semua kondisi bisa berubah besok. Skor diperbarui setiap hari bursa.",
    en: "The score ignores trading costs, and every condition can change tomorrow. It refreshes every trading day.",
  });
  return out;
}

export const BROKER_VERDICT: Record<string, Bi> = {
  "Akumulasi institusi terkonsentrasi — ritel justru menjual": {
    id: "Institusi mengumpulkan barang, ritel justru menjual",
    en: "Institutions accumulating while retail sells",
  },
  "Institusi net beli, ritel net jual": { id: "Institusi membeli, ritel menjual", en: "Institutions buying, retail selling" },
  "Pola distribusi: institusi keluar, ritel menampung": { id: "Institusi keluar, ritel menampung", en: "Institutions exiting, retail absorbing" },
  "Tekanan jual dari institusi maupun ritel": { id: "Institusi dan ritel sama-sama menjual", en: "Both institutions and retail selling" },
  "Belum ada pola broker yang tegas": { id: "Belum ada pola yang jelas", en: "No clear pattern yet" },
};

import type { Bi } from "./i18n";
import type { FeatureKey } from "./types";

export type FamilyKey = "Arus asing" | "Momentum" | "Akumulasi" | "Sektor" | "Risiko";

export const FAMILY: Record<FamilyKey, { label: Bi; what: Bi }> = {
  "Arus asing": {
    label: { id: "Arus dana asing", en: "Foreign money flow" },
    what: {
      id: "Apakah investor asing (umumnya institusi besar) sedang membeli atau menjual saham ini, dan seberapa konsisten.",
      en: "Whether foreign investors (mostly large institutions) are buying or selling this stock, and how consistently.",
    },
  },
  Momentum: {
    label: { id: "Arah harga", en: "Price direction" },
    what: {
      id: "Apakah harga sedang naik lebih cepat dari pasar, dekat dengan puncaknya, atau sedang turun.",
      en: "Whether the price is rising faster than the market, near its high, or falling.",
    },
  },
  Akumulasi: {
    label: { id: "Jejak pembelian", en: "Buying footprint" },
    what: {
      id: "Apakah volume lebih besar di hari naik daripada hari turun, dan apakah harga sedang tenang menyempit. Ini jejak pengumpulan barang.",
      en: "Whether volume is heavier on up days than down days, and whether price is quietly tightening. This is the footprint of accumulation.",
    },
  },
  Sektor: {
    label: { id: "Kekuatan sektor", en: "Sector strength" },
    what: {
      id: "Apakah kelompok industrinya sedang mengungguli pasar. Saham jarang melawan arus sektornya.",
      en: "Whether its industry group is beating the market. Stocks rarely swim against their sector.",
    },
  },
  Risiko: {
    label: { id: "Karakter risiko", en: "Risk character" },
    what: {
      id: "Seberapa bergejolak harganya dan seberapa ramai diperdagangkan.",
      en: "How volatile the price is and how heavily it trades.",
    },
  },
};

/** hi/lo = how to describe the stock when it ranks high or low on this signal today. */
export const FEATURE: Record<FeatureKey, { family: FamilyKey; label: Bi; hi: Bi; lo: Bi }> = {
  ff_persist_20: {
    family: "Arus asing",
    label: { id: "Konsistensi beli asing", en: "Foreign buying consistency" },
    hi: { id: "Asing rutin membeli", en: "Foreigners buying steadily" },
    lo: { id: "Asing jarang membeli", en: "Foreigners rarely buying" },
  },
  ff_intensity_20: {
    family: "Arus asing",
    label: { id: "Kekuatan beli asing (1 bulan)", en: "Foreign buying strength (1 month)" },
    hi: { id: "Asing borong sebulan terakhir", en: "Heavy foreign buying this month" },
    lo: { id: "Asing jual sebulan terakhir", en: "Foreign selling this month" },
  },
  ff_intensity_5: {
    family: "Arus asing",
    label: { id: "Kekuatan beli asing (1 minggu)", en: "Foreign buying strength (1 week)" },
    hi: { id: "Asing borong minggu ini", en: "Heavy foreign buying this week" },
    lo: { id: "Asing jual minggu ini", en: "Foreign selling this week" },
  },
  ff_share_trend: {
    family: "Arus asing",
    label: { id: "Porsi transaksi asing", en: "Foreign share of trading" },
    hi: { id: "Asing makin aktif", en: "Foreigners more active" },
    lo: { id: "Asing makin sepi", en: "Foreigners less active" },
  },
  rs_20: {
    family: "Momentum",
    label: { id: "Naik vs IHSG (1 bulan)", en: "Gain vs IHSG (1 month)" },
    hi: { id: "Naik lebih cepat dari IHSG", en: "Outrunning IHSG" },
    lo: { id: "Tertinggal dari IHSG", en: "Lagging IHSG" },
  },
  rs_60: {
    family: "Momentum",
    label: { id: "Naik vs IHSG (3 bulan)", en: "Gain vs IHSG (3 months)" },
    hi: { id: "Unggul 3 bulan", en: "Ahead over 3 months" },
    lo: { id: "Tertinggal 3 bulan", en: "Behind over 3 months" },
  },
  dist_high_60: {
    family: "Momentum",
    label: { id: "Jarak ke puncak 3 bulan", en: "Distance to 3-month high" },
    hi: { id: "Dekat puncak", en: "Near its high" },
    lo: { id: "Jauh di bawah puncak", en: "Far below its high" },
  },
  trend_50: {
    family: "Momentum",
    label: { id: "Posisi vs tren", en: "Position vs trend" },
    hi: { id: "Di atas tren", en: "Above trend" },
    lo: { id: "Di bawah tren", en: "Below trend" },
  },
  updown_vol_20: {
    family: "Akumulasi",
    label: { id: "Volume naik vs turun", en: "Up vs down volume" },
    hi: { id: "Volume besar saat naik", en: "Heavy volume on up days" },
    lo: { id: "Volume besar saat turun", en: "Heavy volume on down days" },
  },
  vol_surge: {
    family: "Akumulasi",
    label: { id: "Lonjakan volume", en: "Volume surge" },
    hi: { id: "Volume melonjak", en: "Volume surging" },
    lo: { id: "Volume sepi", en: "Volume drying up" },
  },
  range_compress: {
    family: "Akumulasi",
    label: { id: "Rentang harga", en: "Price range" },
    hi: { id: "Harga menyempit (tenang)", en: "Range tightening" },
    lo: { id: "Harga melebar", en: "Range widening" },
  },
  sector_rs_20: {
    family: "Sektor",
    label: { id: "Kekuatan sektor", en: "Sector strength" },
    hi: { id: "Sektornya memimpin", en: "Sector leading" },
    lo: { id: "Sektornya tertinggal", en: "Sector lagging" },
  },
  volatility_20: {
    family: "Risiko",
    label: { id: "Gejolak harga", en: "Price volatility" },
    hi: { id: "Bergejolak", en: "Volatile" },
    lo: { id: "Pergerakan tenang", en: "Calm price action" },
  },
  turnover_20: {
    family: "Risiko",
    label: { id: "Keramaian transaksi", en: "Trading activity" },
    hi: { id: "Sangat ramai", en: "Heavily traded" },
    lo: { id: "Tidak terlalu ramai", en: "Less crowded" },
  },
};

export const FEATURE_KEYS = Object.keys(FEATURE) as FeatureKey[];
export const FAMILY_KEYS = Object.keys(FAMILY) as FamilyKey[];

export function describe(k: FeatureKey, pctl: number | null | undefined): Bi {
  return (pctl ?? 0.5) >= 0.5 ? FEATURE[k].hi : FEATURE[k].lo;
}

export const SUBSECTOR_ID: Record<string, string> = {
  Banks: "Perbankan",
  "Oil, Gas & Coal": "Migas & batu bara",
  "Food & Beverage": "Makanan & minuman",
  "Basic Materials": "Bahan dasar",
  "Properties & Real Estate": "Properti",
  Telecommunication: "Telekomunikasi",
  "Software & IT Services": "Software & TI",
  "Healthcare Equipment & Providers": "Layanan kesehatan",
  "Food & Staples Retailing": "Ritel bahan pokok",
  "Heavy Constructions & Civil Engineering": "Konstruksi",
  "Transportation Infrastructure": "Infrastruktur transportasi",
  "Utilities": "Utilitas",
  "Retailing": "Ritel",
  "Tobacco": "Rokok",
  "Media & Entertainment": "Media & hiburan",
  "Automobiles & Components": "Otomotif",
  "Pharmaceuticals & Health Care Research": "Farmasi",
  "Industrial Goods": "Barang industri",
  "Financing Service": "Pembiayaan",
  "Investment Service": "Jasa investasi",
  "Insurance": "Asuransi",
  "Holding & Investment Companies": "Holding & investasi",
  "Multi-sector Holdings": "Holding multi-sektor",
  "Leisure Goods": "Barang rekreasi",
  "Apparel & Luxury Goods": "Pakaian & barang mewah",
  "Household Goods": "Barang rumah tangga",
  "Nondurable Household Products": "Produk rumah tangga",
  "Consumer Services": "Jasa konsumen",
  "Logistics & Deliveries": "Logistik",
  "Transportation": "Transportasi",
  "Industrial Services": "Jasa industri",
  "Technology Hardware & Equipment": "Perangkat teknologi",
  "Agricultural Products": "Agrikultur",
};

export const SECTOR_ID: Record<string, string> = {
  Financials: "Keuangan",
  Energy: "Energi",
  "Basic Materials": "Bahan dasar",
  "Consumer Non-Cyclicals": "Konsumer primer",
  "Consumer Cyclicals": "Konsumer non-primer",
  Infrastructures: "Infrastruktur",
  "Properties & Real Estate": "Properti",
  Technology: "Teknologi",
  Healthcare: "Kesehatan",
  Industrials: "Perindustrian",
  "Transportation & Logistic": "Transportasi & logistik",
};

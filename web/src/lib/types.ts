export type FeatureKey =
  | "ff_persist_20"
  | "ff_intensity_20"
  | "ff_intensity_5"
  | "ff_share_trend"
  | "rs_20"
  | "rs_60"
  | "dist_high_60"
  | "trend_50"
  | "updown_vol_20"
  | "vol_surge"
  | "range_compress"
  | "sector_rs_20"
  | "volatility_20"
  | "turnover_20"
  | "macro_tail_5"
  | "macro_tail_20";

export type Horizon = 1 | 20;

type PerHorizon<H extends Horizon> = {
  [K in `conf_${H}` | `q_${H}` | `lift_${H}` | `ci_lo_${H}` | `ci_hi_${H}` | `analog_n_${H}` | `analog_n_eff_${H}` | `analog_excess_${H}` | `analog_excess_p25_${H}` | `analog_excess_p75_${H}` | `analog_beat_ihsg_${H}`]: number | null;
} & { [K in `drivers_pos_${H}` | `drivers_neg_${H}`]: FeatureKey[] } & { [K in `c${H}_${FeatureKey}`]: number };

export type Stock = {
  symbol: string;
  name: string | null;
  sector: string | null;
  sub_sector: string | null;
  price: number | null;
  market_cap: number | null;
  rank: number;
  pe_ttm: number | null;
  pb_mrq: number | null;
  roe_ttm: number | null;
  der_mrq: number | null;
  yield_ttm: number | null;
  pct_value: number | null;
  pct_quality: number | null;
  pct_growth: number | null;
  upside_intrinsic: number | null;
  pos_52w: number | null;
  insider_buys: number | null;
  insider_sells: number | null;
  z_foreign: number | null;
  z_volume: number | null;
  z_return: number | null;
  suspended_recent: boolean | null;
  broker_tone: "pos" | "neg" | "neu" | null;
  turnover_med_20: number | null;
  ff_net_20: number | null;
  ff_net_5: number | null;
  ret_1: number | null;
  ret_5: number | null;
  ret_20: number | null;
  atr_pct: number | null;
  support_20: number | null;
  resistance_20: number | null;
  invalidate: number | null;
  sharia: boolean | null;
  group: string | null;
  beta_idr?: number | null;
  beta_oil?: number | null;
  beta_spx?: number | null;
  beta_vix?: number | null;
  beta_usd?: number | null;
  beta_us10y?: number | null;
  ff_today?: number | null;
  ff_typical?: number | null;
  vol_mult?: number | null;
  ret_typical?: number | null;
  fin_score?: number | null;
  fin_n?: number | null;
  fin_grade?: FinGrade | null;
  rev_cagr?: number | null;
} & { [K in FeatureKey]: number | null } & PerHorizon<1> & PerHorizon<20>;

export type Sector = {
  sub_sector: string;
  sector: string | null;
  n: number;
  rs_20: number | null;
  rs_60: number | null;
  foreign_intensity_20: number | null;
  foreign_net_20: number | null;
  avg_conf_1: number | null;
  avg_conf_20: number | null;
  top_pick: string | null;
};

export type Broker = {
  start: string;
  end: string;
  inst_net: number;
  retail_net: number;
  mixed_net: number;
  foreign_broker_net: number;
  foreign_investor_net: number;
  top3_share: number;
  verdict: string;
  tone: "pos" | "neg" | "neu";
  top_buyers: { code: string; net: number; cohort: string | null; foreign: boolean }[];
  top_sellers: { code: string; net: number; cohort: string | null; foreign: boolean }[];
};

export type Metrics = {
  horizon: number;
  n_obs: number;
  n_dates: number;
  n_effective: number;
  n_symbols: number;
  oos_start: string;
  oos_end: string;
  base_rate: number;
  auc_model: number;
  auc_naive: number;
  brier_skill: number;
  brier_skill_sequential: number;
  final_l2: number;
  ihsg_base_rate: number;
  top_decile_hit: number;
  bottom_decile_hit: number;
  top_decile_excess: number;
  bottom_decile_excess: number;
  top_decile_beat_ihsg: number;
  bottom_decile_beat_ihsg: number;
  auc_by_fold_median: number;
  auc_by_fold_min: number;
  auc_by_fold_max: number;
  folds_beating_chance: number;
  n_folds: number;
  /** AUC > 0.5, most periods beat chance, and top group beat bottom group, all out of sample. */
  proven?: boolean;
};

export type Model = {
  metrics: Metrics;
  reliability: { bin: number; pred: number; obs: number; n: number; lo: number | null; hi: number | null }[];
  deciles: { decile: number; hit: number; excess: number; beat_ihsg: number; n: number; p: number; lo: number; hi: number }[];
  folds: { test_start: string; test_end: string; train_end: string; n_train: number; n_test: number; auc: number; l2: number; ihsg_base_rate: number }[];
  coefficients: { feature: FeatureKey; weight: number; family: string }[];
  intercept: number;
  familyAuc: { family: string; auc: number }[];
  calibration: { a: number; b: number };
  equity: { dates: string[]; top: number[]; bottom: number[]; all: number[]; top_net: number[]; cost: number };
  shape: string;
  groupWeights: Record<string, Record<FeatureKey, number>>;
};

export type FinGrade = "strong" | "fair" | "weak";
export type FinCheck = "profit" | "cash" | "roa_up" | "cash_backed" | "leverage_down" | "liquidity_up" | "no_dilution" | "margin_up" | "turnover_up";
export type FinHealth = {
  year: string;
  prev: string;
  score: number;
  n: number;
  grade: FinGrade;
  checks: { k: FinCheck; ok: boolean; a: number | null; b: number | null; u: "idr" | "pct" | "x" | "shares" }[];
  years: string[];
  series: Record<
    "revenue" | "gross_profit" | "earnings" | "operating_cash_flow" | "free_cash_flow" | "total_assets" | "total_liabilities" | "total_equity" | "total_debt" | "total_dividend",
    (number | null)[]
  >;
  rev_cagr: number | null;
  eps_cagr: number | null;
  profitable_years: number;
  net_margin: number | null;
  roa: number | null;
  leverage: number | null;
  current_ratio: number | null;
  dividend_years: number;
};

export type BrokerStyle = "chase" | "absorb" | "steady" | "sell_strength" | "mixed";
export type BrokerProfile = {
  days: number;
  start: string;
  end: string;
  pump_days: string[];
  brokers: {
    code: string;
    name: string | null;
    cohort: string | null;
    foreign: boolean;
    net: number;
    gross: number;
    active: number;
    days_buy: number;
    days_sell: number;
    avg_buy: number | null;
    avg_sell: number | null;
    buy_ret: number | null;
    buy_vol: number | null;
    style: BrokerStyle;
    follow3: number | null;
    n_follow: number;
  }[];
};
export type BrokerMap = Record<string, { name: string | null; cohort: string | null; foreign: boolean; gross: number; acc: { s: string; net: number }[]; dist: { s: string; net: number }[] }>;
export type BrokerSummaryRow = { code: string; net: number; nlot: number; avg: number | null; cohort: string | null; foreign: boolean };
export type BrokerSummary = { from: string; to: string; n: number; buyers: BrokerSummaryRow[]; sellers: BrokerSummaryRow[]; top5_buy: number; top5_sell: number };
export type BrokerIndex = Record<
  string,
  {
    name: string | null;
    cohort: string | null;
    foreign: boolean;
    gross: number;
    net: number;
    n_stocks: number;
    stocks: { s: string; net: number; gross: number; days_buy: number; days_sell: number; avg_buy: number | null; avg_sell: number | null; style: BrokerStyle; follow3: number | null; n_follow: number; rank: number }[];
  }
>;
export type NewsItem = { url: string; ts: string; title: string; body: string; thumb: string | null; symbols: string[]; tags: string[] };

export type MacroKey = "idr" | "oil" | "spx" | "vix" | "usd" | "us10y";

export type Bundle = {
  meta: {
    as_of: string;
    generated_at: string;
    credits_spent: number;
    api_calls: number;
    history_start: string;
    n_history_symbols: number;
    n_ranked: number;
    horizons: number[];
  };
  models: Record<"1" | "20", Model>;
  macro: {
    recent: Record<MacroKey, { last: number; date: string; d5?: number; d20?: number }>;
    series: Record<MacroKey, { date: string[]; v: number[] }>;
  };
  ranking: Stock[];
  sectors: Sector[];
  sectorTs: { sub_sector: string; date: string; rs_20: number }[];
  market: { date: string; ihsg: number | null; foreign_net: number | null }[];
  brokers: Record<string, Broker>;
  bandar?: Record<string, {
    dates: string[];
    inst: number[];
    retail: number[];
    foreign: number[];
    n_buyers: number[];
    n_sellers: number[];
    top_buy: { code: string; net: number; avg: number | null; days_buy: number; cohort: string | null; foreign: boolean }[];
    top_sell: { code: string; net: number; avg: number | null; days_buy: number; cohort: string | null; foreign: boolean }[];
    bandar_avg: number | null;
    inst_streak: number;
  }>;
  families: Record<string, FeatureKey[]>;
  cones?: Record<string, Partial<Record<"1" | "20", { steps: number; lo: number; mid: number; hi: number }[]>>>;
  financials?: Record<string, FinHealth>;
  brokerProfiles?: Record<string, BrokerProfile>;
  brokerSummary?: Record<string, Record<"1" | "5" | "all", BrokerSummary>>;
  news?: Record<string, NewsItem[]>;
  newsLatest?: NewsItem[];
  anomalyHistory?: Record<string, { n1: number; beat1: number | null; med1: number | null; n5: number; beat5: number | null; med5: number | null }>;
  coneCoverage?: Record<"1" | "20", { raw: number; calibrated: number; factor: number; target: number; steps: number; n: number }>;
};

export type Candles = {
  date: string[];
  o: (number | null)[];
  h: (number | null)[];
  l: (number | null)[];
  c: number[];
  v: (number | null)[];
  f: (number | null)[];
  v1?: (number | null)[];
  v20?: (number | null)[];
};
export type Series = Record<string, Candles>;

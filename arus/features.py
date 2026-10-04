"""
Feature engine. Every feature at day t uses only data up to and including day t.

Families that have a real time series (and are therefore *calibrated*):
  - foreign flow  : persistence, intensity vs turnover, foreign-share trend, anomaly
  - momentum      : relative strength vs IHSG, distance to recent high, trend
  - accumulation  : up-volume vs down-volume, volume surge, range compression
  - sector        : sub-sector relative strength (computed from our own universe)
  - risk          : realised volatility, liquidity

Every raw feature is turned into a cross-sectional percentile per day, so the model reads
"how does this stock compare with every other stock today" rather than absolute levels.
"""

import sqlite3

import numpy as np
import pandas as pd

from arus import config

HORIZON = 20                 # trading days ahead for the label
LOOKBACK = 60                # trading days needed before a feature is valid
MIN_TURNOVER = 1e9           # IDR, median 20d traded value to be considered tradable

# Feature name → (family, human label, sign hint for display)
FEATURES = {
    "ff_persist_20":   ("Arus asing", "Hari net-buy asing (20h)", +1),
    "ff_intensity_20": ("Arus asing", "Net asing / nilai transaksi (20h)", +1),
    "ff_intensity_5":  ("Arus asing", "Net asing / nilai transaksi (5h)", +1),
    "ff_share_trend":  ("Arus asing", "Tren porsi asing (10h vs 60h)", +1),
    "rs_20":           ("Momentum", "Return relatif IHSG (20h)", +1),
    "rs_60":           ("Momentum", "Return relatif IHSG (60h)", +1),
    "dist_high_60":    ("Momentum", "Jarak ke puncak 60h", +1),
    "trend_50":        ("Momentum", "Harga vs rata-rata 50h", +1),
    "updown_vol_20":   ("Akumulasi", "Volume naik vs volume turun (20h)", +1),
    "vol_surge":       ("Akumulasi", "Lonjakan volume (5h vs 60h)", +1),
    "range_compress":  ("Akumulasi", "Penyempitan rentang harga", +1),
    "sector_rs_20":    ("Sektor", "Kekuatan relatif subsektor (20h)", +1),
    "volatility_20":   ("Risiko", "Volatilitas 20h", -1),
    "turnover_20":     ("Risiko", "Likuiditas (nilai transaksi 20h)", +1),
    "macro_tail_5":    ("Makro", "Dorongan faktor global 5h", +1),
    "macro_tail_20":   ("Makro", "Dorongan faktor global 20h", +1),
}

MACRO_FACTORS = ("idr", "oil", "spx", "vix", "usd", "us10y")
MIN_GROUP = 7          # sectors with fewer stocks pool into "Lainnya" for the group-specific model
FEATURE_NAMES = list(FEATURES)


def load_panel(conn: sqlite3.Connection | None = None) -> dict:
    conn = conn or sqlite3.connect(config.WAREHOUSE_DB)
    hist = [r[0] for r in conn.execute("SELECT symbol FROM companies WHERE history=1")]
    q = ",".join("?" * len(hist))
    px = pd.read_sql(f"SELECT * FROM prices WHERE symbol IN ({q})", conn, params=hist)
    ff = pd.read_sql(f"SELECT * FROM foreign_flow WHERE symbol IN ({q})", conn, params=hist)
    ihsg = pd.read_sql("SELECT date, price FROM index_daily WHERE index_code='IHSG'", conn)
    comp = pd.read_sql("SELECT symbol, name, sector, sub_sector FROM companies", conn)
    from arus import macro
    return {"prices": px, "flow": ff, "ihsg": ihsg, "companies": comp, "macro": macro.load(conn)}


def _wide(df: pd.DataFrame, col: str) -> pd.DataFrame:
    return df.pivot(index="date", columns="symbol", values=col).sort_index()


def adjust_corporate_actions(o, h, l, c, v) -> tuple:
    """
    Back-adjust prices for splits / reverse splits. IDX auto-rejection caps a day's move
    well below ±60%, so a larger close-to-open gap can only be a corporate action.
    Returns adjusted frames plus a mask of days whose forward labels must be ignored.
    """
    o, h, l, c, v = (x.copy() for x in (o, h, l, c, v))
    contaminated = pd.DataFrame(False, index=c.index, columns=c.columns)
    prev_close = c.shift(1)
    gap = o / prev_close
    for sym in c.columns:
        for d in gap.index[(gap[sym] > 1.6) | (gap[sym] < 0.6)]:
            f = gap.at[d, sym]
            if not np.isfinite(f) or f <= 0:
                continue
            before = c.index < d
            for frame in (o, h, l, c):
                frame.loc[before, sym] = frame.loc[before, sym] * f
            v.loc[before, sym] = v.loc[before, sym] / f
            pos = c.index.get_loc(d)
            lo, hi = max(0, pos - HORIZON - 1), min(len(c.index), pos + 2)
            contaminated.iloc[lo:hi, c.columns.get_loc(sym)] = True
    return o, h, l, c, v, contaminated


def _xs_rank(df: pd.DataFrame) -> pd.DataFrame:
    """Cross-sectional percentile per day (0..1), NaN-aware."""
    return df.rank(axis=1, pct=True)


def build_features(panel: dict) -> tuple[pd.DataFrame, dict]:
    px, ff, ihsg = panel["prices"], panel["flow"], panel["ihsg"]

    o, h, l, c, v = (_wide(px, k) for k in ("open", "high", "low", "close", "volume"))
    o, h, l, c, v, contaminated = adjust_corporate_actions(o, h, l, c, v)
    dates = c.index

    idx = ihsg.set_index("date")["price"].sort_index().reindex(dates).ffill()
    tv = c * v                                           # traded value, IDR
    net = _wide(ff, "net").reindex(index=dates, columns=c.columns)
    share = _wide(ff, "share").reindex(index=dates, columns=c.columns)

    ret = c.pct_change(fill_method=None)
    idx_ret = idx.pct_change()

    raw = {}
    raw["ff_persist_20"] = (net > 0).astype(float).where(net.notna()).rolling(20, min_periods=15).mean()
    tv20 = tv.rolling(20, min_periods=15).sum()
    raw["ff_intensity_20"] = net.rolling(20, min_periods=15).sum() / tv20
    raw["ff_intensity_5"] = net.rolling(5, min_periods=4).sum() / tv.rolling(5, min_periods=4).sum()
    raw["ff_share_trend"] = share.rolling(10, min_periods=8).mean() - share.rolling(60, min_periods=40).mean()

    raw["rs_20"] = c / c.shift(20) - (idx / idx.shift(20)).values[:, None]
    raw["rs_60"] = c / c.shift(60) - (idx / idx.shift(60)).values[:, None]
    raw["dist_high_60"] = c / h.rolling(60, min_periods=40).max() - 1
    raw["trend_50"] = c / c.rolling(50, min_periods=40).mean() - 1

    up_vol = v.where(ret > 0, 0.0).rolling(20, min_periods=15).sum()
    dn_vol = v.where(ret < 0, 0.0).rolling(20, min_periods=15).sum()
    raw["updown_vol_20"] = np.log((up_vol + 1) / (dn_vol + 1))
    raw["vol_surge"] = np.log(v.rolling(5, min_periods=4).mean() / v.rolling(60, min_periods=40).mean())
    rng = (h - l) / c
    raw["range_compress"] = -(rng.rolling(10, min_periods=8).mean() / rng.rolling(60, min_periods=40).mean())

    sub = panel["companies"].set_index("symbol")["sub_sector"].reindex(c.columns)
    rs20 = raw["rs_20"]
    sector_rs = pd.DataFrame(index=dates, columns=c.columns, dtype=float)
    for s, cols in sub.groupby(sub).groups.items():
        cols = list(cols)
        sector_rs[cols] = np.repeat(rs20[cols].median(axis=1).values[:, None], len(cols), axis=1)
    raw["sector_rs_20"] = sector_rs

    # Global influences, stock by stock: rolling 60-day sensitivity (beta) of each stock to
    # each external factor, times that factor's recent move = the push the outside world is
    # giving this particular stock. Factors are lagged one session inside factor_changes.
    from arus import macro as macro_mod
    fc = macro_mod.factor_changes(panel.get("macro", pd.DataFrame()), dates)
    betas, tail5, tail20 = {}, None, None
    for k in MACRO_FACTORS:
        if k not in fc.columns or fc[k].notna().sum() < 60:
            continue
        f = fc[k].fillna(0.0)
        b = ret.rolling(60, min_periods=40).cov(f).div(f.rolling(60, min_periods=40).var(), axis=0)
        betas[k] = b
        p5 = b.mul(f.rolling(5, min_periods=4).sum(), axis=0)
        p20 = b.mul(f.rolling(20, min_periods=15).sum(), axis=0)
        tail5 = p5 if tail5 is None else tail5.add(p5, fill_value=0)
        tail20 = p20 if tail20 is None else tail20.add(p20, fill_value=0)
    raw["macro_tail_5"] = tail5 if tail5 is not None else pd.DataFrame(np.nan, index=dates, columns=c.columns)
    raw["macro_tail_20"] = tail20 if tail20 is not None else pd.DataFrame(np.nan, index=dates, columns=c.columns)

    raw["volatility_20"] = ret.rolling(20, min_periods=15).std()
    turnover_med = tv.rolling(20, min_periods=15).median()
    raw["turnover_20"] = np.log(turnover_med)

    # Label: excess return vs IHSG over the next HORIZON trading days.
    fwd = c.shift(-HORIZON) / c - 1
    idx_fwd = (idx.shift(-HORIZON) / idx - 1).values[:, None]
    excess = fwd - idx_fwd

    tradable = (turnover_med >= MIN_TURNOVER) & c.notna()
    warm = pd.Series(np.arange(len(dates)) >= LOOKBACK, index=dates)
    valid = tradable & warm.values[:, None]

    ranks = {k: _xs_rank(df.where(valid)) for k, df in raw.items()}

    long = []
    for k in FEATURE_NAMES:
        long.append(ranks[k].stack(future_stack=True).rename(k))
    X = pd.concat(long, axis=1)
    X.index.names = ["date", "symbol"]
    X["excess_fwd"] = excess.stack(future_stack=True).reindex(X.index)
    X["contaminated"] = contaminated.stack(future_stack=True).reindex(X.index).fillna(False)
    X["valid"] = valid.stack(future_stack=True).reindex(X.index).fillna(False)
    X = X[X["valid"]].drop(columns="valid")

    sector = panel["companies"].set_index("symbol")["sector"].reindex(c.columns).fillna("Lainnya")
    counts = sector.value_counts()
    group = sector.where(sector.map(counts) >= MIN_GROUP, "Lainnya")

    aux = {"close": c, "open": o, "high": h, "low": l, "volume": v, "raw": raw, "ihsg": idx,
           "net": net, "share": share, "tv": tv, "dates": dates, "excess": excess,
           "betas": {k: b.iloc[-1] for k, b in betas.items()},
           "factor_moves": {k: {"d5": float(fc[k].tail(5).sum()), "d20": float(fc[k].tail(20).sum())} for k in betas},
           "group": group}
    return X, aux

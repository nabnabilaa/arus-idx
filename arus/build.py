"""
Build the snapshot the website reads.

    python -m arus.build                 # features → walk-forward per horizon → snapshot/ + web/src/data/
    python -m arus.build --brokers 30    # also pull broker fingerprints for the top 30 (2 cr each)

The snapshot holds only derived results (no API key, no raw dumps), so the site runs for
anyone who clones the repo, while the pipeline itself stays 100% Sectors-sourced.
"""

import argparse
import json
import sqlite3
import sys
import time

import numpy as np
import pandas as pd

from arus import config, context
from arus.client import SectorsClient
from arus.features import FEATURES, FEATURE_NAMES, build_features, load_panel
from arus.ingest import pull_broker_top
from arus.model import HORIZONS, auc, score_today, walk_forward

PRIMARY = 20          # horizon used for sector summaries and the default ranking order


def _clean(o):
    """Recursively replace NaN/inf with None and numpy scalars with Python ones."""
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    if isinstance(o, (np.floating, float)):
        return float(o) if np.isfinite(o) else None
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, np.bool_):
        return bool(o)
    return o


def _records(df: pd.DataFrame) -> list:
    return json.loads(df.to_json(orient="records", default_handler=str))


def sector_views(aux: dict, companies: pd.DataFrame, rank: pd.DataFrame):
    sub = companies.set_index("symbol")["sub_sector"]
    raw = aux["raw"]
    last = aux["dates"][-1]
    syms = [s for s in aux["close"].columns if s in sub.index]
    groups = pd.Series(syms).groupby(sub.reindex(syms).values)

    rows, ts = [], []
    for s_name, grp in groups:
        cols = list(grp)
        net20 = aux["net"][cols].tail(20).sum().sum()
        tv20 = aux["tv"][cols].tail(20).sum().sum()
        r = rank[rank["symbol"].isin(cols)]
        rows.append({
            "sub_sector": s_name, "sector": companies.set_index("symbol").loc[cols[0], "sector"],
            "n": len(cols),
            "rs_20": float(raw["rs_20"][cols].loc[last].median()),
            "rs_60": float(raw["rs_60"][cols].loc[last].median()),
            "foreign_intensity_20": float(net20 / tv20) if tv20 else np.nan,
            "foreign_net_20": float(net20),
            "avg_conf_1": float(r["conf_1"].mean()) if len(r) else np.nan,
            "avg_conf_20": float(r["conf_20"].mean()) if len(r) else np.nan,
            "top_pick": r.sort_values("conf_20", ascending=False)["symbol"].iloc[0] if len(r) else None,
        })
        med = raw["rs_20"][cols].median(axis=1)
        for d in aux["dates"][::5]:
            if np.isfinite(med.loc[d]):
                ts.append({"sub_sector": s_name, "date": d, "rs_20": float(med.loc[d])})
    return pd.DataFrame(rows).sort_values("rs_20", ascending=False), pd.DataFrame(ts)


def trading_levels(aux: dict, symbols: list[str]) -> pd.DataFrame:
    """Plain levels a daily trader reads: normal daily range, 20-day support/resistance."""
    c, h, l = aux["close"], aux["high"], aux["low"]
    prev = c.shift(1)
    tr = pd.concat([(h - l), (h - prev).abs(), (l - prev).abs()]).groupby(level=0).max()
    atr = tr.rolling(14, min_periods=10).mean()
    rows = []
    for s in symbols:
        if s not in c.columns:
            continue
        px = c[s].iloc[-1]
        a = atr[s].iloc[-1]
        rows.append({
            "symbol": s,
            "atr_pct": float(a / px) if px else np.nan,
            "support_20": float(l[s].tail(20).min()),
            "resistance_20": float(h[s].tail(20).max()),
            "invalidate": float(px - 2 * a) if np.isfinite(a) else np.nan,
            "ret_1": float(px / c[s].iloc[-2] - 1),
            "ret_5": float(px / c[s].iloc[-6] - 1),
            "ret_20": float(px / c[s].iloc[-21] - 1),
        })
    return pd.DataFrame(rows)


def family_auc(cal, X) -> list:
    fams = {}
    for f in FEATURE_NAMES:
        fams.setdefault(FEATURES[f][0], []).append(f)
    joined = cal.oos.merge(X[FEATURE_NAMES].reset_index(), on=["date", "symbol"], how="left")
    out = []
    for family, feats in fams.items():
        sign = np.mean([FEATURES[f][2] for f in feats])
        score = joined[feats].mean(axis=1).fillna(0.5) * sign
        out.append({"family": family, "auc": auc(score.to_numpy(), joined["y"].to_numpy())})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--brokers", type=int, default=0,
                    help="pull broker fingerprints for the top-N ranked names (2 credits each)")
    args = ap.parse_args()
    t0 = time.time()

    conn = sqlite3.connect(config.WAREHOUSE_DB)
    panel = load_panel(conn)
    X, aux = build_features(panel)
    print(f"[build] features: {len(X):,} stock-days, {X.index.get_level_values('symbol').nunique()} "
          f"symbols, {X.index.get_level_values('date').nunique()} dates", flush=True)

    rank = None
    models = {}
    for H in HORIZONS:
        cal = walk_forward(X, aux, H)
        m = cal.metrics
        print(f"[build] H={H:>2}d OOS {m['oos_start']}→{m['oos_end']}  n={m['n_obs']:,} "
              f"AUC={m['auc_model']:.3f} (folds {m['folds_beating_chance']}/{m['n_folds']} > 0.5, "
              f"median {m['auc_by_fold_median']:.3f})  Brier={m['brier_skill']:+.3f}  "
              f"top={m['top_decile_hit']:.3f} bottom={m['bottom_decile_hit']:.3f}", flush=True)
        today = score_today(X, cal)
        keep = ["confidence", "q", "lift", "ci_lo", "ci_hi", "analog_n", "analog_n_eff",
                "analog_excess", "analog_excess_p25", "analog_excess_p75", "analog_beat_ihsg"]
        part = today[keep].rename(columns={k: f"{k}_{H}" for k in keep})
        part = part.rename(columns={f"confidence_{H}": f"conf_{H}"})
        for f in FEATURE_NAMES:
            part[f"c{H}_{f}"] = today[f"c_{f}"]

        def drivers(row, positive):
            items = sorted(((row[f"c{H}_{f}"], f) for f in FEATURE_NAMES), reverse=positive)
            return [f for val, f in items[:3] if (val > 0.01 if positive else val < -0.01)]
        part[f"drivers_pos_{H}"] = part.apply(lambda r: drivers(r, True), axis=1)
        part[f"drivers_neg_{H}"] = part.apply(lambda r: drivers(r, False), axis=1)
        if rank is None:
            rank = today[FEATURE_NAMES].join(part)
        else:
            rank = rank.join(part)
        models[H] = {
            "metrics": m,
            "reliability": _records(cal.reliability),
            "deciles": _records(cal.deciles.dropna(subset=["decile"])),
            "folds": cal.folds,
            "coefficients": _records(cal.coef),
            "intercept": float(cal.final_w[0]),
            "familyAuc": family_auc(cal, X),
            "calibration": {"a": float(cal.platt[0]), "b": float(cal.platt[1])},
        }

    rank = rank.reset_index().rename(columns={"index": "symbol"})
    rank = rank.sort_values(f"conf_{PRIMARY}", ascending=False)
    rank["rank"] = np.arange(1, len(rank) + 1)
    comp = panel["companies"]

    if args.brokers:
        c = SectorsClient(credit_cap=args.brokers * 2 + 4)
        pull_broker_top(c, conn, rank["symbol"].head(args.brokers).tolist())
        print(f"[build] brokers · {c.summary()}", flush=True)

    fund = context.fundamental_context(conn)
    insider = context.insider_context(conn)
    susp = context.suspension_set(conn)
    brokers = context.load_broker_evidence(conn)
    anomalies = context.anomaly_radar(aux, rank["symbol"].tolist())
    levels = trading_levels(aux, rank["symbol"].tolist())

    rank = rank.merge(fund, on="symbol", how="left").merge(insider, on="symbol", how="left") \
        .merge(anomalies, on="symbol", how="left").merge(levels, on="symbol", how="left")
    rank["suspended_recent"] = rank["symbol"].map(lambda s: s in susp)
    rank["broker_tone"] = rank["symbol"].map(lambda s: brokers.get(s, {}).get("tone"))
    rank["price"] = rank["symbol"].map(aux["close"].iloc[-1])
    rank["turnover_med_20"] = rank["symbol"].map(aux["tv"].tail(20).median())
    rank["ff_net_20"] = rank["symbol"].map(aux["net"].tail(20).sum(min_count=1))
    rank["ff_net_5"] = rank["symbol"].map(aux["net"].tail(5).sum(min_count=1))
    sharia = dict(conn.execute("SELECT symbol, COALESCE(jii70, 0) FROM companies").fetchall()) \
        if "jii70" in [r[1] for r in conn.execute("PRAGMA table_info(companies)")] else {}
    rank["sharia"] = rank["symbol"].map(lambda s: bool(sharia.get(s))) if sharia else None

    sectors, sector_ts = sector_views(aux, comp, rank)

    # OHLCV + foreign flow, full history, for the candlestick chart.
    series = {}
    for s in rank["symbol"]:
        if s not in aux["close"].columns:
            continue
        df = pd.DataFrame({"date": aux["dates"], "o": aux["open"][s].values, "h": aux["high"][s].values,
                           "l": aux["low"][s].values, "c": aux["close"][s].values,
                           "v": aux["volume"][s].values, "f": aux["net"][s].values})
        df = df.dropna(subset=["c"])
        series[s] = {k: (df[k].round(2).tolist() if k != "date" else df[k].tolist()) for k in df.columns}

    mkt = pd.DataFrame({"date": aux["dates"], "ihsg": aux["ihsg"].values})
    ff_ihsg = pd.read_sql("SELECT date, net FROM foreign_flow WHERE symbol='IHSG'", conn)
    mkt = mkt.merge(ff_ihsg.rename(columns={"net": "foreign_net"}), on="date", how="left")

    ledger = sqlite3.connect(config.CACHE_DB).execute(
        "SELECT COALESCE(SUM(credits),0), COUNT(*) FROM ledger").fetchone()
    meta = {"as_of": str(aux["dates"][-1]), "generated_at": time.strftime("%Y-%m-%d %H:%M"),
            "credits_spent": ledger[0], "api_calls": ledger[1],
            "history_start": str(aux["dates"][0]), "n_history_symbols": int(aux["close"].shape[1]),
            "n_ranked": int(len(rank)), "horizons": list(HORIZONS)}

    fam = {}
    for f in FEATURE_NAMES:
        fam.setdefault(FEATURES[f][0], []).append(f)
    drop = {"excess_fwd", "contaminated", "name_y", "sector_y", "sub_sector_y"}
    rank = rank[[c for c in rank.columns if c not in drop]]
    bundle = {"meta": meta, "models": {str(k): v for k, v in models.items()},
              "ranking": _records(rank), "sectors": _records(sectors),
              "sectorTs": _records(sector_ts), "market": _records(mkt), "brokers": brokers,
              "families": fam}

    snap = config.SNAPSHOT_DIR
    snap.mkdir(exist_ok=True)
    web = config.ROOT / "web" / "src" / "data"
    web.mkdir(parents=True, exist_ok=True)
    for path in (snap / "arus.json", web / "arus.json"):
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(_clean(bundle), fh, ensure_ascii=False, allow_nan=False)
    for path in (snap / "series.json", web / "series.json"):
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(_clean(series), fh, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    print(f"[build] snapshot written: {len(rank)} ranked · {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()

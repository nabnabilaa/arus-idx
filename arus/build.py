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

from arus import agenda as agenda_mod, config, context, financial, insider as insider_mod, weekly
from arus.client import SectorsClient
from arus.features import FEATURES, FEATURE_NAMES, build_features, load_panel
from arus.ingest import pull_broker_daily, pull_broker_top
from arus.model import HORIZONS, auc, score_dates, score_today, walk_forward

PRIMARY = 1           # horizon used for sector summaries and the default ranking order:
                      # the next-day score held up out of sample (Dec 2025–Oct 2026), the 1-month one did not


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


ROUND_TRIP_COST = 0.004   # ~0.15% buy + 0.25% sell incl. tax, IDX retail brokers


def equity_curve(oos: pd.DataFrame, horizon: int) -> dict:
    """
    Cumulative excess return vs IHSG for the top decile, the bottom decile and all stocks.
    Next-day: rebalanced daily (compounded). One-month: the classic overlapping-portfolio
    approximation — 20 tranches, 1/20 rebalanced each day — so the curve doesn't hinge on
    five non-overlapping points.
    """
    g = oos.groupby(["date", "decile"])["excess"].mean().unstack()
    allm = oos.groupby("date")["excess"].mean()
    dates = sorted(g.index)
    top, bot, alls = g.loc[dates, 9].fillna(0), g.loc[dates, 0].fillna(0), allm.loc[dates].fillna(0)
    if horizon == 1:
        cum = lambda x: (np.cumprod(1 + x.to_numpy()) - 1)
        net = np.cumprod(1 + top.to_numpy() - ROUND_TRIP_COST) - 1
        out = {"top": cum(top), "bottom": cum(bot), "all": cum(alls), "top_net": net}
    else:
        cum = lambda x: np.cumsum(x.to_numpy() / horizon)
        net = np.cumsum(top.to_numpy() / horizon - ROUND_TRIP_COST / horizon)
        out = {"top": cum(top), "bottom": cum(bot), "all": cum(alls), "top_net": net}
    return {"dates": [str(d) for d in dates], **{k: [round(float(v), 5) for v in arr] for k, arr in out.items()},
            "cost": ROUND_TRIP_COST}


def by_size(oos: pd.DataFrame, conn, horizon: int) -> list:
    """The same out-of-sample test split by company size: does the edge survive in large caps, and after costs?"""
    caps = dict(conn.execute("SELECT symbol, market_cap FROM companies WHERE history=1").fetchall())
    o = oos.copy()
    o["cap"] = o["symbol"].map(caps)
    o = o.dropna(subset=["cap"])
    q = o.drop_duplicates("symbol").set_index("symbol")["cap"].rank(pct=True)
    o["size"] = o["symbol"].map(lambda s: "large" if q[s] > 2 / 3 else "mid" if q[s] > 1 / 3 else "small")
    out = []
    for size in ("large", "mid", "small"):
        g = o[o["size"] == size]
        top, bot = g[g["decile"] == 9], g[g["decile"] == 0]
        out.append({"size": size, "n_stocks": int(g["symbol"].nunique()), "auc": auc(g["p_model"].to_numpy(), g["y"].to_numpy()),
                    "top_hit": float(top["y"].mean()) if len(top) else None, "bottom_hit": float(bot["y"].mean()) if len(bot) else None,
                    "top_excess": float(top["excess"].mean()) if len(top) else None,
                    "top_net": float(top["excess"].mean() - ROUND_TRIP_COST / horizon) if len(top) else None})
    return out


CONE_STEPS = {1: [1, 2, 3, 4, 5], 20: [5, 10, 15, 20]}


def forecast_cones(close: pd.DataFrame) -> tuple[dict, dict]:
    """
    80% price range k sessions ahead, per stock: the stock's own historical k-day log-return
    10th/90th percentiles, rescaled by today's 20-day volatility versus its 120-day volatility.
    Raw bands proved too narrow in testing (they held only 64–73% of outcomes), so a single
    widening factor per horizon is calibrated on history to make them hold 80%, and both the
    raw and calibrated coverage are reported.
    """
    logp = np.log(close)
    r1 = logp.diff()
    scale = (r1.rolling(20, min_periods=15).std() / r1.rolling(120, min_periods=60).std()).clip(0.5, 2.0)
    cones, coverage = {}, {}
    for H, steps in CONE_STEPS.items():
        bands = {}
        for k in steps:
            hist = logp - logp.shift(k)
            lo = hist.rolling(120, min_periods=60).quantile(0.10) * scale
            hi = hist.rolling(120, min_periods=60).quantile(0.90) * scale
            bands[k] = (lo, hi)
        k_end = steps[-1]
        rk = logp.shift(-k_end) - logp
        lo_e, hi_e = bands[k_end]
        ok = rk.notna() & lo_e.notna() & hi_e.notna()

        def cover(m):
            return float((((rk >= lo_e * m) & (rk <= hi_e * m)) & ok).sum().sum() / ok.sum().sum())

        raw = cover(1.0)
        m = next((m for m in np.arange(1.0, 3.01, 0.05) if cover(m) >= 0.8), 3.0)
        coverage[str(H)] = {"raw": raw, "calibrated": cover(m), "factor": round(float(m), 2),
                            "target": 0.8, "steps": k_end, "n": int(ok.sum().sum())}
        for sym in close.columns:
            px = close[sym].iloc[-1]
            if not np.isfinite(px):
                continue
            pts = []
            for k in steps:
                lo, hi = bands[k]
                if not (np.isfinite(lo[sym].iloc[-1]) and np.isfinite(hi[sym].iloc[-1])):
                    break
                pts.append({"steps": k, "lo": round(float(px * np.exp(lo[sym].iloc[-1] * m)), 2), "mid": round(float(px), 2),
                            "hi": round(float(px * np.exp(hi[sym].iloc[-1] * m)), 2)})
            if pts:
                cones.setdefault(sym, {})[str(H)] = pts
    return cones, coverage


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


RIGHTS_DILUTION = 0.2       # flag a rights issue that can dilute a non-subscriber by 20%+


def risk_flags(conn, rank: pd.DataFrame, susp: dict, agenda_book: dict, profiles: dict) -> dict:
    """
    Plain risk markers per stock, from facts rather than the model: the exchange's watch board,
    recent suspensions (and whether they were a cooling-down after a run-up), insiders selling
    on the market, a dilutive rights issue ahead, and pump-like broker days.
    """
    boards = dict(conn.execute("SELECT symbol, board FROM idx_companies").fetchall())
    rights = {}
    for it in agenda_book.get("upcoming", []):
        if it["type"] == "right_issue" and (it.get("dilution") or 0) >= RIGHTS_DILUTION:
            rights[it["s"]] = it
    out = {}
    for r in rank.itertuples(index=False):
        s = r.symbol
        f = []
        if boards.get(s) == "Pemantauan Khusus":
            f.append("watch_board")
        if s in susp:
            f.append("cooling_down" if "kumulatif" in (susp[s][1] or "") else "suspended")
        if (getattr(r, "insider_sells", 0) or 0) > (getattr(r, "insider_buys", 0) or 0) and (getattr(r, "insider_net_val", 0) or 0) < -1e9:
            f.append("insider_selling")
        if s in rights:
            f.append("dilution")
        if profiles.get(s, {}).get("pump_days"):
            f.append("pump_like")
        if boards.get(s) == "Akselerasi":
            f.append("acceleration_board")
        out[s] = f
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bandar", type=int, default=0, help="pull 14-day per-broker daily rows for N stocks (1 credit each)")
    ap.add_argument("--brokers", type=int, default=0,
                    help="pull broker fingerprints for the top-N ranked names (2 credits each)")
    args = ap.parse_args()
    t0 = time.time()

    from arus.ingest import connect as warehouse
    conn = warehouse()
    panel = load_panel(conn)
    X, aux = build_features(panel)
    print(f"[build] features: {len(X):,} stock-days, {X.index.get_level_values('symbol').nunique()} "
          f"symbols, {X.index.get_level_values('date').nunique()} dates", flush=True)

    rank = None
    models = {}
    verdict_hist = {}
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
            rank = today[FEATURE_NAMES + ["group"]].join(part)
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
            "equity": equity_curve(cal.oos, H),
            "bySize": by_size(cal.oos, conn, H),
            "shape": cal.shape,
            "groupWeights": cal.group_weights,
        }
        q = pd.concat([cal.oos[["date", "symbol", "q"]], score_dates(X, cal, str(cal.oos["date"].max()))])
        q["v"] = np.select([q["q"] >= 0.9, q["q"] >= 0.7, q["q"] > 0.3, q["q"] > 0.1], [4, 3, 2, 1], 0)
        verdict_hist[H] = {(d, s_): int(v) for d, s_, v in zip(q["date"], q["symbol"], q["v"])}

    rank = rank.reset_index().rename(columns={"index": "symbol"})
    rank = rank.sort_values(f"conf_{PRIMARY}", ascending=False)
    rank["rank"] = np.arange(1, len(rank) + 1)
    comp = panel["companies"]

    if args.brokers:
        c = SectorsClient(credit_cap=args.brokers * 2 + 4)
        n_top = max(1, args.brokers * 2 // 3)
        picks = rank["symbol"].head(n_top).tolist() + rank["symbol"].tail(args.brokers - n_top).tolist()
        pull_broker_top(c, conn, picks)
        print(f"[build] brokers · {c.summary()}", flush=True)
    if args.bandar:
        c = SectorsClient(credit_cap=args.bandar + 4)
        n_top = max(1, args.bandar * 2 // 3)
        picks = rank["symbol"].head(n_top).tolist() + rank["symbol"].tail(args.bandar - n_top).tolist()
        pull_broker_daily(c, conn, picks)
        print(f"[build] bandar daily · {c.summary()}", flush=True)

    fund = context.fundamental_context(conn)
    names = dict(conn.execute("SELECT symbol, name FROM idx_companies").fetchall())
    insider_book = insider_mod.build(conn, names)
    insider = insider_mod.per_stock(insider_book)
    susp = context.suspension_set(conn)
    brokers = context.load_broker_evidence(conn)
    bandar = context.bandar_daily(conn)
    anomalies = context.anomaly_radar(aux, rank["symbol"].tolist())
    levels = trading_levels(aux, rank["symbol"].tolist())

    rank = rank.merge(fund, on="symbol", how="left").merge(insider, on="symbol", how="left") \
        .merge(anomalies, on="symbol", how="left").merge(levels, on="symbol", how="left")
    profiles, broker_index, broker_summary = context.broker_profiles(conn, aux)
    news_by_stock, news_latest = context.recent_news(conn)
    health = financial.load(conn)
    rank["fin_score"] = rank["symbol"].map(lambda s: health.get(s, {}).get("score"))
    rank["fin_n"] = rank["symbol"].map(lambda s: health.get(s, {}).get("n"))
    rank["fin_grade"] = rank["symbol"].map(lambda s: health.get(s, {}).get("grade"))
    rank["rev_cagr"] = rank["symbol"].map(lambda s: health.get(s, {}).get("rev_cagr"))
    tiers = dict(conn.execute("SELECT symbol, COALESCE(tier, 'full') FROM companies WHERE history=1").fetchall())
    rank["tier"] = rank["symbol"].map(lambda s: tiers.get(s, "full"))
    rank["suspended_recent"] = rank["symbol"].map(lambda s: s in susp)
    agenda_book = agenda_mod.build(conn, str(aux["dates"][-1]), names)
    rank["risk_flags"] = rank["symbol"].map(risk_flags(conn, rank, susp, agenda_book, profiles))
    rank["broker_tone"] = rank["symbol"].map(lambda s: brokers.get(s, {}).get("tone"))
    rank["price"] = rank["symbol"].map(aux["close"].iloc[-1])
    rank["turnover_med_20"] = rank["symbol"].map(aux["tv"].tail(20).median())
    rank["ff_net_20"] = rank["symbol"].map(aux["net"].tail(20).sum(min_count=1))
    rank["ff_net_5"] = rank["symbol"].map(aux["net"].tail(5).sum(min_count=1))
    for k, b in aux.get("betas", {}).items():
        rank[f"beta_{k}"] = rank["symbol"].map(b)
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
        for H, vh in verdict_hist.items():
            series[s][f"v{H}"] = [vh.get((d, s)) for d in series[s]["date"]]

    cones, cone_cov = forecast_cones(aux["close"])
    print(f"[build] forecast cones: {[(h, round(v['raw'], 3), '->', round(v['calibrated'], 3), 'x' + str(v['factor'])) for h, v in cone_cov.items()]}", flush=True)

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
    macro_df = __import__("arus.macro", fromlist=["load"]).load(conn)
    macro_recent = {k: {"last": float(macro_df[k].dropna().iloc[-1]), "date": str(macro_df[k].dropna().index[-1]),
                        **aux.get("factor_moves", {}).get(k, {})} for k in macro_df.columns}
    macro_series = {k: {"date": [str(d) for d in macro_df[k].dropna().index[-260:]],
                        "v": [round(float(v), 4) for v in macro_df[k].dropna().values[-260:]]} for k in macro_df.columns}
    bundle = {"meta": meta, "models": {str(k): v for k, v in models.items()},
              "macro": {"recent": macro_recent, "series": macro_series,
                        "commodities": __import__("arus.macro", fromlist=["commodity_prices"]).commodity_prices()},
              "ranking": _records(rank), "sectors": _records(sectors),
              "sectorTs": _records(sector_ts), "market": _records(mkt), "brokers": brokers, "bandar": bandar,
              "cones": cones, "coneCoverage": cone_cov, "financials": health,
              "anomalyHistory": context.anomaly_history(aux),
              "brokerProfiles": profiles, "brokerSummary": broker_summary,
              "news": news_by_stock, "newsLatest": news_latest,
              "families": fam}

    snap = config.SNAPSHOT_DIR
    snap.mkdir(exist_ok=True)
    web = config.ROOT / "web" / "src" / "data"
    web.mkdir(parents=True, exist_ok=True)
    for path in (snap / "arus.json", web / "arus.json"):
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(_clean(bundle), fh, ensure_ascii=False, allow_nan=False)
    published = [h for h in HORIZONS if models[h]["metrics"].get("proven", True)] or [1]
    (web / "published.json").write_text(json.dumps({"horizons": published}), encoding="utf-8")
    for path in (snap / "brokers.json", web / "brokers.json"):
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(_clean(broker_index), fh, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    week = weekly.build(conn, names, _clean(insider_book), _clean(agenda_book))
    for path in (snap / "weekly.json", web / "weekly.json"):
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(_clean(week), fh, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    for path in (snap / "agenda.json", web / "agenda.json"):
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(_clean(agenda_book), fh, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    for path in (snap / "insider.json", web / "insider.json"):
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(_clean(insider_book), fh, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    for path in (snap / "series.json", web / "series.json"):
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(_clean(series), fh, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    print(f"[build] snapshot written: {len(rank)} ranked · {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()

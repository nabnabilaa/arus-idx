"""
Evidence & context — shown next to the confidence number, never mixed into it.

Why separate: broker-summary `/top/` is a range aggregate and fundamentals are a single
snapshot, so neither can be walk-forward tested without look-ahead. They are evidence
for a human to weigh, labelled as such in the UI.
"""

import json
import sqlite3

import numpy as np
import pandas as pd

from arus import config


# ---------------------------------------------------------------------------
# broker fingerprint ("sidik jari bandar")
# ---------------------------------------------------------------------------
def broker_fingerprint(payload: dict, registry: dict) -> dict:
    """Read a /broker-summary/{sym}/top/ payload through the broker registry."""
    buyers = payload.get("top_buyers", []) or []
    sellers = payload.get("top_sellers", []) or []
    by_cohort = {"institutional": 0.0, "retail": 0.0, "mixed": 0.0, "unknown": 0.0}
    foreign_broker_net = 0.0
    for row in buyers + sellers:
        reg = registry.get(row["broker_code"], {})
        by_cohort[reg.get("cohort") or "unknown"] = \
            by_cohort.get(reg.get("cohort") or "unknown", 0.0) + row["net_idr"]
        if reg.get("is_foreign"):
            foreign_broker_net += row["net_idr"]
    foreign_investor_net = sum(r.get("foreign_net_idr") or 0 for r in buyers + sellers)
    buy_total = sum(max(r["net_idr"], 0) for r in buyers)
    top3_share = (sum(max(r["net_idr"], 0) for r in buyers[:3]) / buy_total) if buy_total else 0
    inst, retail = by_cohort["institutional"], by_cohort["retail"]

    if inst > 0 and retail < 0 and top3_share >= 0.5:
        verdict, tone = "Akumulasi institusi terkonsentrasi — ritel justru menjual", "pos"
    elif inst > 0 and retail < 0:
        verdict, tone = "Institusi net beli, ritel net jual", "pos"
    elif inst < 0 and retail > 0:
        verdict, tone = "Pola distribusi: institusi keluar, ritel menampung", "neg"
    elif inst < 0 and retail < 0:
        verdict, tone = "Tekanan jual dari institusi maupun ritel", "neg"
    else:
        verdict, tone = "Belum ada pola broker yang tegas", "neu"

    return {
        "start": payload.get("start"), "end": payload.get("end"),
        "inst_net": inst, "retail_net": retail, "mixed_net": by_cohort["mixed"],
        "foreign_broker_net": foreign_broker_net, "foreign_investor_net": foreign_investor_net,
        "top3_share": top3_share, "verdict": verdict, "tone": tone,
        "top_buyers": [{"code": r["broker_code"], "net": r["net_idr"],
                        "cohort": registry.get(r["broker_code"], {}).get("cohort"),
                        "foreign": bool(registry.get(r["broker_code"], {}).get("is_foreign"))}
                       for r in buyers[:5]],
        "top_sellers": [{"code": r["broker_code"], "net": r["net_idr"],
                         "cohort": registry.get(r["broker_code"], {}).get("cohort"),
                         "foreign": bool(registry.get(r["broker_code"], {}).get("is_foreign"))}
                        for r in sellers[:5]],
    }


def load_broker_evidence(conn: sqlite3.Connection) -> dict:
    registry = {r[0]: {"name": r[1], "is_foreign": bool(r[2]), "cohort": r[3]}
                for r in conn.execute("SELECT code, name, is_foreign, cohort FROM brokers")}
    out = {}
    for sym, payload in conn.execute("SELECT symbol, payload FROM broker_top"):
        out[sym] = broker_fingerprint(json.loads(payload), registry)
    return out


# ---------------------------------------------------------------------------
# fundamentals vs sub-sector peers
# ---------------------------------------------------------------------------
def fundamental_context(conn: sqlite3.Connection) -> pd.DataFrame:
    rows = []
    for sym, name, sector, sub, mcap, fund, pr in conn.execute(
            "SELECT symbol, name, sector, sub_sector, market_cap, fundamentals, price_ranges "
            "FROM companies"):
        f = json.loads(fund or "{}")
        p = json.loads(pr or "{}")
        rows.append({"symbol": sym, "name": name, "sector": sector, "sub_sector": sub,
                     "market_cap": mcap, **f, **{f"px_{k}": v for k, v in p.items()}})
    df = pd.DataFrame(rows)

    def peer_pct(col, higher_better):
        s = df[col].where(df[col].notna())
        if col in ("pe_ttm", "pb_mrq", "ps_ttm", "forward_pe"):
            s = s.where(s > 0)                     # negative multiples are not "cheap"
        r = s.groupby(df["sub_sector"]).rank(pct=True)
        return r if higher_better else 1 - r + (1 / s.groupby(df["sub_sector"]).transform("count"))

    df["pct_value"] = pd.concat([peer_pct("pe_ttm", False), peer_pct("pb_mrq", False)],
                                axis=1).mean(axis=1)
    df["pct_quality"] = pd.concat([peer_pct("roe_ttm", True), peer_pct("der_mrq", False)],
                                  axis=1).mean(axis=1)
    df["pct_growth"] = pd.concat([peer_pct("yoy_quarter_earnings_growth", True),
                                  peer_pct("yoy_quarter_revenue_growth", True)],
                                 axis=1).mean(axis=1)
    price = df["px_last_close_price"]
    df["upside_intrinsic"] = np.where((df["intrinsic_value"] > 0) & (price > 0),
                                      df["intrinsic_value"] / price - 1, np.nan)
    hi, lo = df["px_52_w_high_price"], df["px_52_w_low_price"]
    df["pos_52w"] = np.where(hi > lo, (price - lo) / (hi - lo), np.nan)
    return df


# ---------------------------------------------------------------------------
# insider filings & suspensions
# ---------------------------------------------------------------------------
def insider_context(conn: sqlite3.Connection) -> pd.DataFrame:
    df = pd.read_sql("SELECT * FROM filings", conn)
    if df.empty:
        return pd.DataFrame(columns=["symbol", "insider_buys", "insider_sells", "last_filing"])
    g = df.groupby("symbol")
    return pd.DataFrame({
        "insider_buys": g.apply(lambda x: int((x["transaction_type"] == "buy").sum()),
                                include_groups=False),
        "insider_sells": g.apply(lambda x: int((x["transaction_type"] == "sell").sum()),
                                 include_groups=False),
        "last_filing": g["ts"].max(),
    }).reset_index()


def suspension_set(conn: sqlite3.Connection) -> dict:
    return {s: (d, r) for s, d, r in conn.execute(
        "SELECT symbol, MAX(date), reason FROM suspensions GROUP BY symbol")}


# ---------------------------------------------------------------------------
# anomaly radar
# ---------------------------------------------------------------------------
def anomaly_radar(aux: dict, symbols: list[str]) -> pd.DataFrame:
    """How unusual is today vs this stock's own last 60 days (robust z-scores)."""
    net, tv, close = aux["net"], aux["tv"], aux["close"]
    vol = tv / close
    rows = []
    for s in symbols:
        if s not in close.columns:
            continue
        n = net[s].dropna().tail(61)
        v = vol[s].dropna().tail(61)
        r = close[s].pct_change(fill_method=None).dropna().tail(61)

        def rz(series):
            if len(series) < 30:
                return np.nan
            hist, today = series.iloc[:-1], series.iloc[-1]
            med = hist.median()
            mad = (hist - med).abs().median() * 1.4826
            return float((today - med) / mad) if mad > 0 else np.nan

        hist_n, hist_v, hist_r = n.iloc[:-1], v.iloc[:-1], r.iloc[:-1]
        rows.append({"symbol": s, "z_foreign": rz(n), "z_volume": rz(np.log(v + 1)),
                     "z_return": rz(r),
                     # the same event in plain units, so "unusual" can be read as rupiah and multiples
                     "ff_today": float(n.iloc[-1]) if len(n) else np.nan,
                     "ff_typical": float(hist_n.abs().median()) if len(hist_n) else np.nan,
                     "vol_mult": float(v.iloc[-1] / hist_v.median()) if len(hist_v) and hist_v.median() > 0 else np.nan,
                     "ret_typical": float(hist_r.abs().median()) if len(hist_r) else np.nan})
    return pd.DataFrame(rows)


def anomaly_history(aux: dict, threshold: float = 3.0) -> dict:
    """
    What followed past events of each kind across the universe: for every stock-day whose
    robust z-score (vs the prior 60 days) passed the threshold, did the stock beat the median
    stock over the next 1 and 5 sessions? Descriptive and in-sample, over Arus' own history.
    """
    net, tv, close = aux["net"], aux["tv"], aux["close"]
    vol = np.log(tv / close + 1)
    ret = close.pct_change(fill_method=None)
    fwd = {h: close.shift(-h) / close - 1 for h in (1, 5)}
    excess = {h: f.sub(f.median(axis=1), axis=0) for h, f in fwd.items()}
    out = {}
    for key, x in (("foreign", net), ("volume", vol), ("return", ret)):
        prior = x.shift(1)
        med = prior.rolling(60, min_periods=30).median()
        mad = (prior - med).abs().rolling(60, min_periods=30).median() * 1.4826
        z = (x - med) / mad.where(mad > 0)
        for sign, name in ((1, "up"), (-1, "down")):
            mask = (z * sign) >= threshold
            row = {}
            for h in (1, 5):
                e = excess[h][mask].stack().dropna()
                row[f"n{h}"] = int(len(e))
                row[f"beat{h}"] = float((e > 0).mean()) if len(e) else None
                row[f"med{h}"] = float(e.median()) if len(e) else None
            out[f"{key}_{name}"] = row
    return out


# ---------------------------------------------------------------------------
# daily bandar flow (per-broker rows per day)
# ---------------------------------------------------------------------------
def bandar_daily(conn: sqlite3.Connection) -> dict:
    """
    Per stock, per day: net value bought by institutional brokers, retail brokers and
    foreign investors; plus the brokers that accumulated most over the window and the
    average price they paid — the "bandar cost" retail traders watch.
    """
    registry = {r[0]: {"is_foreign": bool(r[2]), "cohort": r[3]}
                for r in conn.execute("SELECT code, name, is_foreign, cohort FROM brokers")}
    out = {}
    rows = conn.execute("SELECT symbol, date, payload FROM broker_daily ORDER BY symbol, date").fetchall()
    by_sym = {}
    for sym, d, payload in rows:
        by_sym.setdefault(sym, []).append((d, json.loads(payload)))
    for sym, days in by_sym.items():
        dates, inst, retail, foreign, n_buyers, n_sellers = [], [], [], [], [], []
        acc = {}
        for d, summ in days:
            i_net = r_net = f_net = 0.0
            nb = ns = 0
            for b in summ:
                net = (b.get("bval") or 0) - (b.get("sval") or 0)
                cohort = registry.get(b["broker_code"], {}).get("cohort") or "unknown"
                if cohort == "institutional":
                    i_net += net
                elif cohort == "retail":
                    r_net += net
                f_net += (b.get("f_bval") or 0) - (b.get("f_sval") or 0)
                nb += net > 0
                ns += net < 0
                a = acc.setdefault(b["broker_code"], {"net": 0.0, "bval": 0.0, "blot": 0.0, "days_buy": 0})
                a["net"] += net
                a["bval"] += b.get("bval") or 0
                a["blot"] += b.get("blot") or 0
                a["days_buy"] += net > 0
            dates.append(d)
            inst.append(i_net)
            retail.append(r_net)
            foreign.append(f_net)
            n_buyers.append(nb)
            n_sellers.append(ns)
        ranked = sorted(acc.items(), key=lambda kv: -kv[1]["net"])
        def card(code, a):
            reg = registry.get(code, {})
            avg = a["bval"] / (a["blot"] * 100) if a["blot"] else None
            return {"code": code, "net": a["net"], "avg": avg, "days_buy": a["days_buy"],
                    "cohort": reg.get("cohort"), "foreign": bool(reg.get("is_foreign"))}
        top_buy = [card(c, a) for c, a in ranked[:5] if a["net"] > 0]
        top_sell = [card(c, a) for c, a in ranked[::-1][:5] if a["net"] < 0]
        tot_val = sum(x["net"] for x in top_buy)
        bandar_avg = (sum(x["avg"] * x["net"] for x in top_buy[:3] if x["avg"]) /
                      sum(x["net"] for x in top_buy[:3] if x["avg"])) if top_buy and any(x["avg"] for x in top_buy[:3]) else None
        streak = 0
        for v in reversed(inst):
            if v > 0 and streak >= 0:
                streak += 1
            elif v < 0 and streak <= 0:
                streak -= 1
            else:
                break
        out[sym] = {"dates": dates, "inst": inst, "retail": retail, "foreign": foreign,
                    "n_buyers": n_buyers, "n_sellers": n_sellers, "top_buy": top_buy, "top_sell": top_sell,
                    "bandar_avg": bandar_avg, "inst_streak": streak, "top_buy_total": tot_val}
    return out

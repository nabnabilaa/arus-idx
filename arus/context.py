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

        rows.append({"symbol": s, "z_foreign": rz(n), "z_volume": rz(np.log(v + 1)),
                     "z_return": rz(r)})
    return pd.DataFrame(rows)

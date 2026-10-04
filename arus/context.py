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


# ---------------------------------------------------------------------------
# broker behaviour: how each broker trades a stock, not just how much
# ---------------------------------------------------------------------------
def broker_profiles(conn: sqlite3.Connection, aux: dict) -> tuple[dict, dict, dict]:
    """
    Broker behaviour from Sectors' daily per-broker rows, three ways:

    - per stock: the most active brokers, when they tend to buy (into rising, crowded days =
      chasing; into falling days = absorbing), and what the price did over the next 3 sessions
      after their buying against the median stock; plus "pump-like" days (a sharp rise on heavy
      volume while retail brokers buy and institutions sell);
    - per broker: every tracked stock it traded, with the same statistics, for the broker page;
    - per stock summaries for the last 1, 5 and all sessions (top buyers and sellers with lots,
      value and average price), the broker-summary view traders know.

    Windows are a few weeks long, so these describe recent habits, not proven edges.
    """
    registry = {r[0]: {"name": r[1], "foreign": bool(r[2]), "cohort": r[3]}
                for r in conn.execute("SELECT code, name, is_foreign, cohort FROM brokers")}
    close, tv = aux["close"], aux["tv"]
    ret = close.pct_change(fill_method=None)
    vol = tv / close
    vol_ratio = vol / vol.rolling(20, min_periods=10).median().shift(1)
    fwd3 = close.shift(-3) / close - 1
    excess3 = fwd3.sub(fwd3.median(axis=1), axis=0)

    rows = conn.execute("SELECT symbol, date, payload FROM broker_daily ORDER BY symbol, date").fetchall()
    by_sym: dict[str, list] = {}
    for sym, d, payload in rows:
        by_sym.setdefault(sym, []).append((d, json.loads(payload)))

    def wavg(items, k):
        pts = [(it[0], it[k]) for it in items if it[k] is not None and np.isfinite(it[k])]
        tot = sum(w for w, _ in pts)
        return float(sum(w * v for w, v in pts) / tot) if tot else None

    def summarise(code, a):
        reg = registry.get(code, {})
        buy_ret, buy_vol = wavg(a["buy_days"], 1), wavg(a["buy_days"], 2)
        sell_ret = wavg(a["sell_days"], 1)
        style = "mixed"
        if len(a["buy_days"]) >= 3 and buy_ret is not None:
            if buy_ret > 0.01 and (buy_vol or 0) > 1.3:
                style = "chase"
            elif buy_ret < -0.005:
                style = "absorb"
            elif len(a["buy_days"]) >= 0.7 * a["active"]:
                style = "steady"
        if style == "mixed" and len(a["sell_days"]) >= 3 and sell_ret is not None and sell_ret > 0.01:
            style = "sell_strength"
        follow = [it[3] for it in a["buy_days"] if it[3] is not None and np.isfinite(it[3])]
        return {
            "code": code, "name": reg.get("name"), "cohort": reg.get("cohort"), "foreign": reg.get("foreign", False),
            "net": a["net"], "gross": a["gross"], "active": a["active"],
            "days_buy": len(a["buy_days"]), "days_sell": len(a["sell_days"]),
            "avg_buy": a["bval"] / (a["blot"] * 100) if a["blot"] else None,
            "avg_sell": a["sval"] / (a["slot"] * 100) if a["slot"] else None,
            "buy_ret": buy_ret, "buy_vol": buy_vol, "style": style,
            "follow3": float(np.mean(follow)) if follow else None, "n_follow": len(follow),
        }

    def period(days):
        """Top buyers and sellers over a run of days, as lots, value and average price."""
        acc = {}
        for _, summ in days:
            for b in summ:
                code = b["broker_code"]
                if code not in registry:
                    continue
                a = acc.setdefault(code, [0.0, 0.0, 0.0, 0.0])
                a[0] += b.get("bval") or 0
                a[1] += b.get("blot") or 0
                a[2] += b.get("sval") or 0
                a[3] += b.get("slot") or 0
        rows_ = [{"code": c, "net": v[0] - v[2], "bval": v[0], "blot": v[1], "sval": v[2], "slot": v[3],
                  "avg": (v[0] / (v[1] * 100) if v[0] > v[2] and v[1] else v[2] / (v[3] * 100) if v[3] else None),
                  "cohort": registry[c]["cohort"], "foreign": registry[c]["foreign"]}
                 for c, v in acc.items()]
        buyers = sorted([r for r in rows_ if r["net"] > 0], key=lambda r: -r["net"])[:10]
        sellers = sorted([r for r in rows_ if r["net"] < 0], key=lambda r: r["net"])[:10]
        for r in buyers + sellers:
            r["nlot"] = r["blot"] - r["slot"]
            for k in ("bval", "blot", "sval", "slot"):
                del r[k]
        top_b = sum(r["net"] for r in buyers[:5])
        top_s = -sum(r["net"] for r in sellers[:5])
        return {"from": days[0][0], "to": days[-1][0], "n": len(days), "buyers": buyers, "sellers": sellers,
                "top5_buy": top_b, "top5_sell": top_s}

    profiles, per_broker, summaries = {}, {}, {}
    for sym, days in by_sym.items():
        if sym not in close.columns:
            continue
        acc: dict[str, dict] = {}
        pump_days = []
        for d, summ in days:
            r = ret[sym].get(d)
            vr = vol_ratio[sym].get(d)
            ex = excess3[sym].get(d)
            inst = retail = 0.0
            for b in summ:
                code = b["broker_code"]
                if code not in registry:          # "--" and other non-member rows
                    continue
                net = (b.get("bval") or 0) - (b.get("sval") or 0)
                cohort = registry[code]["cohort"]
                inst += net if cohort == "institutional" else 0
                retail += net if cohort == "retail" else 0
                a = acc.setdefault(code, {"net": 0.0, "gross": 0.0, "bval": 0.0, "blot": 0.0, "sval": 0.0, "slot": 0.0,
                                          "buy_days": [], "sell_days": [], "active": 0})
                a["net"] += net
                a["gross"] += (b.get("bval") or 0) + (b.get("sval") or 0)
                a["bval"] += b.get("bval") or 0
                a["blot"] += b.get("blot") or 0
                a["sval"] += b.get("sval") or 0
                a["slot"] += b.get("slot") or 0
                a["active"] += 1
                if net > 0:
                    a["buy_days"].append((net, r, vr, ex))
                elif net < 0:
                    a["sell_days"].append((-net, r, vr, ex))
            if r is not None and vr is not None and np.isfinite(r) and np.isfinite(vr) and r > 0.03 and vr > 2 and retail > 0 > inst:
                pump_days.append(d)

        stats = {code: summarise(code, a) for code, a in acc.items()}
        ranked = sorted(stats.values(), key=lambda x: -x["gross"])
        profiles[sym] = {"days": len(days), "start": days[0][0], "end": days[-1][0], "brokers": ranked[:8], "pump_days": pump_days}
        for st in ranked:
            if st["gross"] <= 0:
                continue
            row = {k: st[k] for k in ("net", "gross", "days_buy", "days_sell", "avg_buy", "avg_sell", "style", "follow3", "n_follow")}
            row["s"] = sym
            row["rank"] = ranked.index(st) + 1             # 1 = the most active broker in that stock
            per_broker.setdefault(st["code"], []).append(row)
        summaries[sym] = {"1": period(days[-1:]), "5": period(days[-5:]), "all": period(days)}

    broker_index = {}
    for code, lst in per_broker.items():
        reg = registry.get(code, {})
        lst.sort(key=lambda r: -r["gross"])
        broker_index[code] = {"name": reg.get("name"), "cohort": reg.get("cohort"), "foreign": reg.get("foreign", False),
                              "gross": sum(r["gross"] for r in lst), "net": sum(r["net"] for r in lst),
                              "n_stocks": len(lst), "stocks": lst[:60]}
    return profiles, broker_index, summaries


def recent_news(conn: sqlite3.Connection, per_stock: int = 6) -> tuple[dict, list]:
    """Stored Sectors news, newest first: a few per stock plus the latest across the market."""
    try:
        rows = conn.execute("SELECT url, ts, title, body, thumbnail, symbols, tags FROM news ORDER BY ts DESC").fetchall()
    except sqlite3.OperationalError:
        return {}, []
    by_sym, latest = {}, []
    for url, ts, title, body, thumb, syms, tags in rows:
        item = {"url": url, "ts": ts, "title": title, "body": body, "thumb": thumb,
                "symbols": json.loads(syms or "[]"), "tags": json.loads(tags or "[]")}
        if len(latest) < 24:
            latest.append(item)
        for s in item["symbols"]:
            lst = by_sym.setdefault(s, [])
            if len(lst) < per_stock:
                lst.append(item)
    return by_sym, latest

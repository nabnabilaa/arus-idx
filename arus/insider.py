"""
Insider filings ("orang dalam") — who inside a company bought or sold, how often, at what
price, and what the price did after the filing became public.

Source: Sectors `/v2/filings/` (KSEI ownership reports). The full structured rows — holder,
holding before/after, the dated trades behind each filing — are read from the permanent
response cache, so this costs no credits beyond the original pull.

"What followed" is measured from the first session the filing could be acted on (a filing
published after the 16:00 close counts from the next session), against the median IDX stock,
so it reads as "did the stock do better than a typical stock", not as a forecast.
"""

import json
import sqlite3
from datetime import datetime

import numpy as np
import pandas as pd

from arus import config

HORIZONS = (5, 20)
KSEI = "https://www.idx.co.id/StaticData/NewsAndAnnouncement/ANNOUNCEMENTSTOCK/From_KSEI/"
CLOSE_HOUR = 16
# filings that move shares without a market decision to buy or sell: repo pledges, private
# placements, option plans, restructurings, takeovers and forced free-float sales
BLOCK_POINTS = 5.0
NON_MARKET = {"repurchase-agreement", "placement", "capital-restructuring", "mesop", "takeover", "free_float_compliance"}


def _bare(sym: str) -> str:
    return (sym or "").replace(".JK", "").upper()


def load_filings(cache_db=config.CACHE_DB) -> pd.DataFrame:
    """Every cached /v2/filings/ row, de-duplicated across overlapping pulls."""
    rows = []
    con = sqlite3.connect(cache_db)
    for (body,) in con.execute("SELECT body FROM responses WHERE path = '/v2/filings/' AND status = 200"):
        for r in (json.loads(body) or {}).get("results", []) or []:
            trades = r.get("price_transaction") or []
            rows.append({
                "s": _bare(r.get("symbol")), "ts": r.get("timestamp"),
                "holder": (r.get("holder_name") or "").strip(), "kind": r.get("holder_type"),
                "side": r.get("transaction_type"),
                "sh": r.get("amount_transaction"), "px": r.get("price"), "val": r.get("transaction_value"),
                "pb": r.get("share_percentage_before"), "pa": r.get("share_percentage_after"),
                "tags": r.get("tags") or [], "grp": r.get("idx_conglomerates_group_slug"),
                "url": r.get("source"),
                "trades": [{"d": t.get("date"), "px": t.get("price"), "sh": t.get("amount_transacted")}
                           for t in trades if t.get("date")],
            })
    con.close()
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    df = df[df["side"].isin(["buy", "sell"]) & (df["s"] != "") & df["ts"].notna()]
    df = df.drop_duplicates(subset=["s", "holder", "ts", "sh"]).sort_values("ts", ascending=False)
    return df.reset_index(drop=True)


def close_panel(conn: sqlite3.Connection) -> pd.DataFrame:
    """Daily closes for every IDX stock (free IDX summary), dates × symbols."""
    px = pd.read_sql("SELECT symbol, date, close FROM idx_daily WHERE close > 0", conn)
    return px.pivot_table(index="date", columns="symbol", values="close").sort_index()


def _entry_index(dates: list[str], ts: str) -> int | None:
    """Index of the first session a filing published at `ts` could be traded on."""
    t = datetime.fromisoformat(ts)
    day = t.date().isoformat()
    after_close = t.hour >= CLOSE_HOUR
    for i, d in enumerate(dates):
        if d > day or (d == day and not after_close):
            return i
    return None


def build(conn: sqlite3.Connection, names: dict[str, str] | None = None, cache_db=config.CACHE_DB) -> dict:
    df = load_filings(cache_db)
    if df.empty:
        return {"events": [], "chains": [], "after": {}, "window": None}
    names = names or {}
    close = close_panel(conn)
    dates = list(close.index)
    last = close.ffill().iloc[-1]
    fwd = {h: close.shift(-h) / close - 1 for h in HORIZONS}
    excess = {h: f.sub(f.median(axis=1), axis=0) for h, f in fwd.items()}

    events = []
    for r in df.itertuples(index=False):
        i = _entry_index(dates, r.ts)
        has_px = r.s in close.columns
        # a filing price far from where the stock traded is a source error (e.g. a total value
        # in the price field): keep the filing, drop its price and value from every sum
        ref = close[r.s].loc[:r.ts[:10]].dropna() if has_px else pd.Series(dtype=float)
        bad = bool(len(ref) and r.px and not (0.2 < r.px / ref.iloc[-1] < 5))
        entry = float(close[r.s].iloc[i]) if has_px and i is not None and np.isfinite(close[r.s].iloc[i]) else None
        now = float(last[r.s]) if has_px and np.isfinite(last[r.s]) else None
        ex = {}
        for h in HORIZONS:
            v = excess[h][r.s].iloc[i] if has_px and i is not None else np.nan
            ex[f"ex{h}"] = float(v) if np.isfinite(v) else None
        events.append({
            "s": r.s, "name": names.get(r.s), "ts": r.ts, "d": dates[i] if i is not None else None,
            "holder": r.holder, "kind": r.kind, "side": r.side,
            "sh": r.sh, "px": None if bad else r.px, "val": None if bad else r.val, "pb": r.pb, "pa": r.pa, "bad": bad,
            "tags": [t for t in r.tags if t != "investment"], "grp": r.grp if isinstance(r.grp, str) else None, "url": r.url,
            "entry": entry, "now": now, "since": (now / entry - 1) if entry and now else None, **ex,
        })

    # a holder filing both buys and sells in one stock is usually a securities house making a
    # market or an underwriter placing shares, not a conviction trade: flag it, keep it out of chains
    ev = pd.DataFrame(events)
    sides = ev.groupby(["s", "holder"])["side"].nunique()
    twoway = set(sides[sides > 1].index)
    ev["twoway"] = [(s_, h) in twoway for s_, h in zip(ev["s"], ev["holder"])]
    # a buy matched by a sell of the same block in the same stock within a few days is a transfer
    # between holders (restructuring, family or group moves), not a market decision
    transfer = set()
    for (s_, sh), g in ev[ev["sh"].fillna(0) > 0].groupby(["s", "sh"]):
        if g["side"].nunique() == 2:
            days = pd.to_datetime(g["ts"].str[:10])
            if (days.max() - days.min()).days <= 5:
                transfer.update(g.index)
    # one filing that moves 5+ percentage points of the company is a block deal (restructuring,
    # takeover, placement), however it is tagged at the source
    block = (ev["pa"] - ev["pb"]).abs() >= BLOCK_POINTS
    ev["transfer"] = ev.index.isin(list(transfer)) | block.fillna(False)
    ev["market"] = [not (set(t) & NON_MARKET) and not b and not tr for t, b, tr in zip(ev["tags"], ev["bad"], ev["transfer"])]
    for e, tw, mk, tr in zip(events, ev["twoway"], ev["market"], ev["transfer"]):
        e["twoway"] = bool(tw)
        e["market"] = bool(mk)
        if tr:
            e["tags"] = [*e["tags"], "transfer"]

    # chains: the same holder filing on the same side of the same stock more than once
    chains = []
    for (s, holder, side), g in ev[~ev["twoway"] & ev["market"]].groupby(["s", "holder", "side"]):
        if len(g) < 2:
            continue
        g = g.sort_values("ts")
        sh = float(g["sh"].fillna(0).sum())
        val = float(g["val"].fillna(0).sum())
        daily = {}
        for ts in df[(df["s"] == s) & (df["holder"] == holder) & (df["side"] == side)]["trades"]:
            for t in ts:
                if t["sh"] and t["px"]:
                    a = daily.setdefault(t["d"], [0.0, 0.0])
                    a[0] += t["sh"]
                    a[1] += t["sh"] * t["px"]
        trades = [{"d": d, "sh": a[0], "px": round(a[1] / a[0], 1)} for d, a in sorted(daily.items())]
        now = g["now"].dropna().iloc[-1] if g["now"].notna().any() else None
        avg = val / sh if sh else None
        chains.append({
            "s": s, "name": names.get(s), "holder": holder, "side": side, "kind": g["kind"].iloc[-1],
            "n": int(len(g)), "sh": sh, "val": val, "avg": avg,
            "first": g["ts"].iloc[0], "last": g["ts"].iloc[-1],
            "pb": g["pb"].iloc[0], "pa": g["pa"].iloc[-1], "grp": g["grp"].dropna().iloc[0] if g["grp"].notna().any() else None,
            # a filing price far from the market (rights, crossings, splits) makes "vs" meaningless
            "now": now, "vs": (now / avg - 1) if now and avg and 0.25 < now / avg < 4 else None,
            "trades": trades[-60:],
        })
    chains.sort(key=lambda c: (-c["n"], -c["val"]))

    # price path for the chain stocks, so a chain can be drawn with its buy points
    paths = {}
    for c in chains[:40]:
        if c["s"] in close.columns and c["s"] not in paths:
            start = min(t["d"] for t in c["trades"]) if c["trades"] else c["first"][:10]
            col = close[c["s"]]
            col = col[col.index >= start].dropna()
            paths[c["s"]] = {"d": list(col.index), "c": [round(float(v), 2) for v in col.values]}

    def summary(rows: pd.DataFrame) -> dict:
        out = {"n_events": int(len(rows))}
        for h in HORIZONS:
            e = rows[f"ex{h}"].dropna()
            out[f"n{h}"] = int(len(e))
            out[f"beat{h}"] = float((e > 0).mean()) if len(e) else None
            out[f"med{h}"] = float(e.median()) if len(e) else None
        return out

    one = ev[~ev["twoway"] & ev["market"]]
    chain_keys = {(c["s"], c["holder"]) for c in chains if c["side"] == "buy" and c["n"] >= 3}
    after = {
        "buy": summary(one[one["side"] == "buy"]),
        "sell": summary(one[one["side"] == "sell"]),
        # repeated buying by one holder (3+ filings) — the "insider chain" pattern
        "chain_buy": summary(one[(one["side"] == "buy") & np.array([(s_, h) in chain_keys for s_, h in zip(one["s"], one["holder"])], dtype=bool)]),
    }
    window = {"from": df["ts"].min()[:10], "to": df["ts"].max()[:10], "n": int(len(df))}

    # compact for the site: names and latest prices once per stock, KSEI links as file names
    stocks = {}
    for e in events:
        stocks.setdefault(e["s"], {"name": e.pop("name"), "now": e.pop("now")})
        e["url"] = (e["url"] or "").removeprefix(KSEI) or None
        for k in ("px", "entry", "since", "ex5", "ex20", "pb", "pa"):
            if isinstance(e[k], float):
                e[k] = round(e[k], 4) if np.isfinite(e[k]) else None
    for c in chains:
        c.pop("name", None)
    return {"events": events, "chains": chains, "paths": paths, "after": after, "window": window,
            "stocks": stocks, "ksei": KSEI}


def per_stock(book: dict) -> pd.DataFrame:
    """Per-symbol counts of market trades (no repo, placements or two-way holders), for the ranking and risk flags."""
    ev = pd.DataFrame(book.get("events") or [])
    cols = ["symbol", "insider_buys", "insider_sells", "insider_net_val", "last_filing"]
    if ev.empty:
        return pd.DataFrame(columns=cols)
    ev = ev[ev["market"] & ~ev["twoway"]]
    if ev.empty:
        return pd.DataFrame(columns=cols)
    ev["signed"] = np.where(ev["side"] == "buy", 1, -1) * ev["val"].fillna(0)
    g = ev.groupby("s")
    return pd.DataFrame({
        "insider_buys": g.apply(lambda x: int((x["side"] == "buy").sum()), include_groups=False),
        "insider_sells": g.apply(lambda x: int((x["side"] == "sell").sum()), include_groups=False),
        "insider_net_val": g["signed"].sum(),
        "last_filing": g["ts"].max(),
    }).reset_index().rename(columns={"s": "symbol"})

"""
Agenda — upcoming corporate actions (dividends, AGMs, rights issues, splits, warrants) and
what usually happens to the price around an ex-dividend date.

Source: Sectors `/v2/corporate-actions/` calendar, one call per action type (1 credit each),
read back from the permanent response cache and de-duplicated across pulls.
"""

import json
import sqlite3

import numpy as np
import pandas as pd

from arus import config
from arus.insider import close_panel

TYPES = ("upcoming_dividend", "dividend", "agm", "right_issue", "stock_split", "warrant", "bonus")
KEY_DATE = {"upcoming_dividend": "ex_date", "dividend": "ex_date", "right_issue": "ex_date", "bonus": "ex_date",
            "stock_split": "date", "warrant": "trading_period_start", "agm": "agm_date"}
RECOVER_WITHIN = 20


def _bare(sym: str) -> str:
    return (sym or "").replace(".JK", "").upper()


def pull_calendar(c, start: str, end: str, types=TYPES[:-1]):
    """One calendar call per type for the window (the API clamps it to 90 days ending at `end`)."""
    for t in types:
        c.get("/v2/corporate-actions/", {"start": start, "end": end, "type": t})


def load_actions(cache_db=config.CACHE_DB) -> pd.DataFrame:
    rows = []
    con = sqlite3.connect(cache_db)
    for params, body in con.execute("SELECT params, body FROM responses WHERE path = '/v2/corporate-actions/' AND status = 200"):
        data = json.loads(body) or {}
        for t in TYPES:
            for r in data.get(t) or []:
                d = r.get(KEY_DATE[t])
                if d:
                    rows.append({"type": "dividend" if t == "upcoming_dividend" else t, "s": _bare(r.get("symbol")), "date": d, "raw": r})
    con.close()
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    return df.drop_duplicates(subset=["type", "s", "date"], keep="last").sort_values(["date", "s"]).reset_index(drop=True)


def ex_dividend_study(divs: pd.DataFrame, close: pd.DataFrame) -> tuple[dict, dict]:
    """
    For each past dividend: the ex-date move against the dividend yield, and whether the
    price got back to its cum-date close within 20 sessions.
    """
    dates = list(close.index)
    out = []
    for r in divs.itertuples(index=False):
        amt = r.raw.get("dividend_amount")
        if r.s not in close.columns or not amt:
            continue
        ex = r.date
        i = next((k for k, d in enumerate(dates) if d >= ex), None)
        if i is None or i == 0 or i + 1 > len(dates):
            continue
        cum_px, ex_px = close[r.s].iloc[i - 1], close[r.s].iloc[i]
        if not (np.isfinite(cum_px) and np.isfinite(ex_px)) or cum_px <= 0:
            continue
        y = amt / cum_px
        move = ex_px / cum_px - 1
        after = close[r.s].iloc[i:i + RECOVER_WITHIN + 1]
        rec = next((k for k, v in enumerate(after.values) if np.isfinite(v) and v >= cum_px), None)
        complete = len(after) > RECOVER_WITHIN
        out.append({"s": r.s, "ex": ex, "amt": amt, "yield": y, "move": move,
                    "drop_ratio": (-move / y) if y > 0 else np.nan,
                    "recovered": rec, "complete": complete})
    st = pd.DataFrame(out)
    if st.empty:
        return {}, {}
    full = st[st["complete"] | st["recovered"].notna()]
    summary = {
        "n": int(len(st)),
        "yield_med": float(st["yield"].median()),
        "move_med": float(st["move"].median()),
        "drop_ratio_med": float(st["drop_ratio"].median()),
        "n_window": int(len(full)),
        "recovered_share": float(full["recovered"].notna().mean()) if len(full) else None,
        "recover_days_med": float(full["recovered"].dropna().median()) if full["recovered"].notna().any() else None,
        "within": RECOVER_WITHIN,
    }
    by_stock = {}
    for r in st.to_dict("records"):
        by_stock.setdefault(r["s"], []).append({"ex": r["ex"], "amt": r["amt"], "yield": r["yield"], "move": r["move"],
                                                "recovered": None if pd.isna(r["recovered"]) else int(r["recovered"])})
    return summary, by_stock


def build(conn: sqlite3.Connection, as_of: str, names: dict[str, str] | None = None, cache_db=config.CACHE_DB) -> dict:
    names = names or {}
    acts = load_actions(cache_db)
    if acts.empty:
        return {"upcoming": [], "study": {}, "history": {}}
    close = close_panel(conn)
    last = close.ffill().iloc[-1]

    past_divs = acts[(acts["type"] == "dividend") & (acts["date"] <= as_of)]
    study, history = ex_dividend_study(past_divs, close)

    upcoming = []
    for r in acts[acts["date"] > as_of].itertuples(index=False):
        x = r.raw
        px = float(last[r.s]) if r.s in last.index and np.isfinite(last[r.s]) else None
        item = {"s": r.s, "name": names.get(r.s), "type": r.type, "date": r.date, "px": px}
        if r.type == "dividend":
            amt = x.get("dividend_amount")
            item.update({"amt": amt, "cum": x.get("cum_date"), "pay": x.get("payment_date"),
                         "yield": (amt / px) if amt and px else None})
        elif r.type == "agm":
            item.update({"time": (x.get("agm_time") or "")[:5] or None, "place": x.get("agm_place")})
        elif r.type == "right_issue":
            old, new = x.get("old_ratio"), x.get("new_ratio")
            item.update({"cum": x.get("cum_date"), "price": x.get("price"), "old": old, "new": new,
                         "trade_from": x.get("trading_period_start"), "trade_to": x.get("trading_period_end"),
                         # dilution if every right is exercised: new shares per existing share
                         "dilution": (new / (old + new)) if old and new else None,
                         "discount": (x.get("price") / px - 1) if x.get("price") and px else None})
        elif r.type == "stock_split":
            item.update({"ratio": x.get("ratio"), "cum": x.get("cum_date")})
        elif r.type == "warrant":
            item.update({"price": x.get("price"), "ratio": f"{x.get('ratio_shares'):g}:{x.get('ratio_warrant'):g}" if x.get("ratio_shares") else None,
                         "to": x.get("trading_period_end")})
        elif r.type == "bonus":
            item.update({"cum": x.get("cum_date")})
        upcoming.append(item)
    return {"as_of": as_of, "upcoming": upcoming, "study": study, "history": history}

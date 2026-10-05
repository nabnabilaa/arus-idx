"""
Weekly recap — the week in one page, computed rather than written: index and breadth, the
biggest liquid movers, where foreign money went, sectors, unusual volume, insider filings,
and a rule-based "what supports / what to be careful about" read built from those numbers.

Prices, volume and foreign flow come from the official IDX daily summary (all listed stocks,
no credits); insider filings and the coming agenda reuse the Sectors-derived books.
"""

import sqlite3

import numpy as np
import pandas as pd

LIQUID = 1e9          # median daily value over the prior 20 sessions, IDR: below this a % move is noise
WEEK = 5


def _panel(conn: sqlite3.Connection, col: str) -> pd.DataFrame:
    df = pd.read_sql(f"SELECT symbol, date, {col} AS v FROM idx_daily", conn)
    return df.pivot_table(index="date", columns="symbol", values="v").sort_index()


def build(conn: sqlite3.Connection, names: dict[str, str], insider_book: dict, agenda_book: dict) -> dict:
    close = _panel(conn, "close").where(lambda x: x > 0)
    value = _panel(conn, "value")
    # the IDX summary reports foreign buys and sells in shares: value them at the day's average price
    vwap = value / _panel(conn, "volume").where(lambda x: x > 0)
    fnet = _panel(conn, "fbuy").sub(_panel(conn, "fsell"), fill_value=0) * vwap
    dates = list(close.index)
    if len(dates) < WEEK + 21:
        return {}
    end, start_ref = dates[-1], dates[-WEEK - 1]
    week_dates = dates[-WEEK:]
    sectors = dict(conn.execute("SELECT symbol, sektor FROM idx_companies").fetchall())
    boards = dict(conn.execute("SELECT symbol, board FROM idx_companies").fetchall())

    ret = close.loc[end] / close.loc[start_ref] - 1
    med_val = value.loc[:start_ref].tail(20).median()
    liquid = med_val[med_val >= LIQUID].index
    traded = ret.dropna().index

    # index
    ihsg = pd.read_sql("SELECT date, price FROM index_daily WHERE index_code='IHSG' ORDER BY date", conn).set_index("date")["price"]
    ihsg_w = float(ihsg.loc[end] / ihsg.loc[start_ref] - 1) if end in ihsg.index and start_ref in ihsg.index else None
    ihsg_days = [{"d": d, "v": float(ihsg.loc[d]), "chg": float(ihsg.loc[d] / ihsg.shift(1).loc[d] - 1)} for d in week_dates if d in ihsg.index]

    # big caps: the 45 largest by traded value as a stand-in for the blue-chip basket
    big = list(med_val.sort_values(ascending=False).head(45).index)
    big_ret = ret.reindex(big).dropna()

    def mover(s):
        return {"s": s, "name": names.get(s), "ret": float(ret[s]), "close": float(close.loc[end, s]),
                "val": float(value.loc[week_dates, s].sum()), "board": boards.get(s)}

    lr = ret.reindex(liquid).dropna().sort_values()
    gainers = [mover(s) for s in lr.index[::-1][:6]]
    losers = [mover(s) for s in lr.index[:6]]
    # the all-stock extreme, kept to show why the liquid filter exists
    raw_top = ret.dropna().sort_values(ascending=False)
    raw_top = [mover(s) for s in raw_top.index[:1]]

    fw = fnet.loc[week_dates].sum()
    f_buy = [{"s": s, "name": names.get(s), "net": float(fw[s]), "ret": float(ret.get(s, np.nan))} for s in fw.sort_values(ascending=False).index[:6]]
    f_sell = [{"s": s, "name": names.get(s), "net": float(fw[s]), "ret": float(ret.get(s, np.nan))} for s in fw.sort_values().index[:6]]
    f_total = float(fw.sum())
    f_days = [{"d": d, "net": float(fnet.loc[d].sum())} for d in week_dates]

    sec = pd.DataFrame({"ret": ret.reindex(traded), "sector": [sectors.get(s) for s in traded]}).dropna()
    sec_rows = (sec.groupby("sector")["ret"].agg(["median", "count", lambda x: float((x > 0).mean())])
                .rename(columns={"median": "ret", "count": "n", "<lambda_0>": "up"}).reset_index()
                .sort_values("ret", ascending=False))
    sector_list = [{"sector": r.sector, "ret": float(r.ret), "n": int(r.n), "up": float(r.up)} for r in sec_rows.itertuples(index=False)]

    # unusual volume this week: the biggest single-day value vs the stock's prior 60-day median
    base = med_val
    peak = value.loc[week_dates].max()
    mult = (peak / base).reindex(liquid).replace([np.inf], np.nan).dropna().sort_values(ascending=False)
    spikes = [{"s": s, "name": names.get(s), "mult": float(mult[s]), "day": str(value.loc[week_dates, s].idxmax()),
               "ret": float(ret.get(s, np.nan))} for s in mult.index[:6]]

    up = int((ret.reindex(traded) > 0).sum())
    down = int((ret.reindex(traded) < 0).sum())

    ev = [e for e in insider_book.get("events", []) if e.get("market") and not e.get("twoway") and e["ts"][:10] > start_ref]
    ins_buy = sum(e["val"] or 0 for e in ev if e["side"] == "buy")
    ins_sell = sum(e["val"] or 0 for e in ev if e["side"] == "sell")
    ins_top = sorted(ev, key=lambda e: -(e["val"] or 0))[:5]
    insiders = {"n": len(ev), "buy": ins_buy, "sell": ins_sell,
                "top": [{k: e[k] for k in ("s", "holder", "side", "val", "px", "pa", "ts")} for e in ins_top]}

    cooling = sorted({s for s, d, r in conn.execute("SELECT symbol, date, reason FROM suspensions")
                      if d > start_ref and "kumulatif" in (r or "")})

    ahead = [it for it in agenda_book.get("upcoming", []) if it["type"] != "agm"][:10]
    n_agm = sum(1 for it in agenda_book.get("upcoming", []) if it["type"] == "agm")

    stats = {"ihsg": ihsg_w, "big_med": float(big_ret.median()) if len(big_ret) else None,
             "big_up": int((big_ret > 0).sum()), "big_n": int(len(big_ret)), "up": up, "down": down,
             "foreign": f_total, "best_sector": sector_list[0] if sector_list else None,
             "worst_sector": sector_list[-1] if sector_list else None, "n_cooling": len(cooling)}

    return {
        "from": week_dates[0], "to": end, "stats": stats, "ihsg_days": ihsg_days,
        "gainers": gainers, "losers": losers, "raw_top": raw_top,
        "foreign": {"total": f_total, "days": f_days, "buy": f_buy, "sell": f_sell},
        "sectors": sector_list, "spikes": spikes, "insiders": insiders, "cooling": cooling,
        "ahead": ahead, "n_agm": n_agm, "reads": reads(stats, insiders),
    }


def reads(st: dict, ins: dict) -> dict:
    """Two lists of plain statements, each tied to a number above, never a call to act."""
    pos, neg = [], []

    def say(cond, lst, idt, ent):
        if cond:
            lst.append({"id": idt, "en": ent})

    pct = lambda x: f"{x * 100:+.1f}%".replace(".", ",")
    pct_en = lambda x: f"{x * 100:+.1f}%"
    num = lambda x, d=2: f"{x:,.{d}f}".replace(",", "_").replace(".", ",").replace("_", ".")
    breadth = st["up"] / max(1, st["up"] + st["down"])
    if st["ihsg"] is not None:
        a = abs(st["ihsg"]) * 100
        say(st["ihsg"] > 0, pos, f"IHSG naik {num(a, 1)}% sepekan.", f"IHSG rose {a:.1f}% on the week.")
        say(st["ihsg"] <= 0, neg, f"IHSG turun {num(a, 1)}% sepekan.", f"IHSG fell {a:.1f}% on the week.")
    say(breadth >= 0.55, pos, f"Kenaikan merata: {st['up']} saham naik vs {st['down']} turun.", f"Broad gains: {st['up']} stocks up vs {st['down']} down.")
    say(breadth <= 0.45, neg, f"Penurunan merata: {st['down']} saham turun vs {st['up']} naik.", f"Broad losses: {st['down']} stocks down vs {st['up']} up.")
    if st["big_n"]:
        say(st["big_up"] / st["big_n"] >= 0.55, pos, f"{st['big_up']} dari {st['big_n']} saham paling likuid naik.", f"{st['big_up']} of the {st['big_n']} most liquid stocks rose.")
        say(st["big_up"] / st["big_n"] <= 0.35, neg, f"Hanya {st['big_up']} dari {st['big_n']} saham paling likuid yang naik.", f"Only {st['big_up']} of the {st['big_n']} most liquid stocks rose.")
    f = st["foreign"] / 1e12
    say(st["foreign"] > 0, pos, f"Asing beli bersih Rp{num(f)} T sepekan.", f"Foreigners net bought IDR {f:.2f}T on the week.")
    say(st["foreign"] < 0, neg, f"Asing jual bersih Rp{num(abs(f))} T sepekan.", f"Foreigners net sold IDR {abs(f):.2f}T on the week.")
    if st["best_sector"] and st["best_sector"]["ret"] > 0:
        b = st["best_sector"]
        pos.append({"id": f"Sektor terkuat: {b['sector']} (median {pct(b['ret'])}).", "en": f"Strongest sector: {b['sector']} (median {pct_en(b['ret'])})."})
    if st["worst_sector"] and st["worst_sector"]["ret"] < 0:
        w = st["worst_sector"]
        neg.append({"id": f"Sektor terlemah: {w['sector']} (median {pct(w['ret'])}).", "en": f"Weakest sector: {w['sector']} (median {pct_en(w['ret'])})."})
    say(ins["buy"] > ins["sell"] * 1.5 and ins["buy"] > 1e10, pos,
        f"Orang dalam lebih banyak membeli (Rp{num(ins['buy'] / 1e9, 0)} M) daripada menjual (Rp{num(ins['sell'] / 1e9, 0)} M).",
        f"Insiders bought more (IDR {ins['buy'] / 1e9:,.0f}B) than they sold (IDR {ins['sell'] / 1e9:,.0f}B).")
    say(ins["sell"] > ins["buy"] * 1.5 and ins["sell"] > 1e10, neg,
        f"Orang dalam lebih banyak menjual (Rp{num(ins['sell'] / 1e9, 0)} M) daripada membeli (Rp{num(ins['buy'] / 1e9, 0)} M).",
        f"Insiders sold more (IDR {ins['sell'] / 1e9:,.0f}B) than they bought (IDR {ins['buy'] / 1e9:,.0f}B).")
    say(st["n_cooling"] >= 3, neg, f"{st['n_cooling']} saham dihentikan sementara (cooling down) setelah naik terlalu cepat.",
        f"{st['n_cooling']} stocks were halted for cooling-down after rising too fast.")
    return {"pos": pos, "neg": neg}

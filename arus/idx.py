"""
Free daily top-up from the Indonesia Stock Exchange's own trading summary.

Sectors stays the core source (history, broker flow, financials, news, fundamentals); this
module only fills trading days Sectors hasn't been asked for yet, so the daily refresh costs no
credits. It never overwrites a row that came from Sectors.

Checked against Sectors on 2026-10-02: open/high/low/close/volume match exactly. IDX reports
foreign buying and selling in shares, so it is converted to rupiah at the day's average price
(value ÷ volume); that lands within a few percent of Sectors' rupiah figures.

Usage:
    python -m arus.idx                   # fill every missing trading day up to today
    python -m arus.idx --until 2026-10-06
"""

import argparse
import sys
from datetime import date, timedelta

from curl_cffi import requests

from arus.ingest import connect

BASE = "https://www.idx.co.id"
PAGE = BASE + "/id/data-pasar/ringkasan-perdagangan/ringkasan-saham/"


def session() -> requests.Session:
    # the site sits behind Cloudflare; this browser fingerprint is accepted, plain clients get 403
    s = requests.Session(impersonate="chrome124")
    s.get(PAGE, timeout=30)
    return s


def _get(s: requests.Session, path: str, day: date) -> list[dict]:
    r = s.get(BASE + path, params={"length": 9999, "start": 0, "date": day.strftime("%Y%m%d")},
              headers={"Referer": PAGE, "Accept": "application/json, text/plain, */*"}, timeout=40)
    r.raise_for_status()
    return r.json().get("data", [])


def store_day(conn, s: requests.Session, day: date, symbols: set[str]) -> int:
    rows = _get(s, "/primary/TradingSummary/GetStockSummary", day)
    rows = [x for x in rows if x.get("Volume")]
    if not rows:
        return 0                                   # holiday or not published yet
    d = day.isoformat()
    total_buy = total_sell = 0.0
    n = 0
    for x in rows:
        vwap = x["Value"] / x["Volume"]
        buy, sell = (x.get("ForeignBuy") or 0) * vwap, (x.get("ForeignSell") or 0) * vwap
        total_buy += buy
        total_sell += sell
        sym = x["StockCode"]
        if sym not in symbols:
            continue
        cap = x["Close"] * x["ListedShares"] if x.get("ListedShares") else None
        conn.execute("INSERT OR IGNORE INTO prices VALUES (?,?,?,?,?,?,?,?)",
                     (sym, d, x["OpenPrice"] or x["Close"], x["High"] or x["Close"], x["Low"] or x["Close"],
                      x["Close"], x["Volume"], cap))
        conn.execute("INSERT OR IGNORE INTO foreign_flow VALUES (?,?,?,?,?,?)",
                     (sym, d, buy - sell, buy, sell, (buy + sell) / (2 * x["Value"]) if x["Value"] else None))
        n += 1
    idx = [x for x in _get(s, "/primary/TradingSummary/GetIndexSummary", day) if x.get("IndexCode") == "COMPOSITE"]
    if idx:
        conn.execute("INSERT OR IGNORE INTO index_daily VALUES ('IHSG', ?, ?)", (d, idx[0]["Close"]))
        value = idx[0].get("Value") or 0
        conn.execute("INSERT OR IGNORE INTO foreign_flow VALUES ('IHSG',?,?,?,?,?)",
                     (d, total_buy - total_sell, total_buy, total_sell, (total_buy + total_sell) / (2 * value) if value else None))
    conn.commit()
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--until", default=date.today().isoformat())
    args = ap.parse_args()
    conn = connect()
    symbols = {r[0] for r in conn.execute("SELECT symbol FROM companies WHERE history=1")}
    last = conn.execute("SELECT MAX(date) FROM prices").fetchone()[0]
    day = date.fromisoformat(last) + timedelta(days=1)
    until = date.fromisoformat(args.until)
    s = session()
    while day <= until:
        if day.weekday() < 5:
            n = store_day(conn, s, day, symbols)
            print(f"[idx] {day}: {n} stocks" if n else f"[idx] {day}: no trading data (holiday or not yet published)", flush=True)
        day += timedelta(days=1)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()

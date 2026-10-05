"""
Widen Arus from the 120 Sectors-history stocks to every liquid IDX stock, at no credit cost.

The 120 "full" stocks keep everything Sectors provides (history, broker flow, financials, news).
Every other stock that trades at least `MIN_VALUE` a day on median gets a "basic" tier built from the
exchange's own daily trading summary: prices, volume and foreign flow, so charts, typical ranges,
unusual-activity flags, the stop/target planner, sector views and global sensitivity all work for it.

Steps (each resumable, run in order):
    python -m arus.universe profiles      # 962 listed companies with IDX sector names
    python -m arus.universe backfill      # one trading summary per day since history start
    python -m arus.universe expand        # add liquid stocks as tier "basic"
"""

import argparse
import json
import sys
import time
from collections import Counter, defaultdict
from datetime import date, timedelta

from arus.idx import BASE, PAGE, _get, session
from arus.ingest import connect

MIN_VALUE = 1e9          # median daily traded value (IDR) over the last 60 sessions
START = date(2025, 7, 11)  # same start as the Sectors history

SCHEMA = """
CREATE TABLE IF NOT EXISTS idx_companies (
    symbol TEXT PRIMARY KEY, name TEXT, sektor TEXT, subsektor TEXT, board TEXT);
CREATE TABLE IF NOT EXISTS idx_daily (
    symbol TEXT, date TEXT, open REAL, high REAL, low REAL, close REAL, volume REAL, value REAL,
    fbuy REAL, fsell REAL, listed REAL, PRIMARY KEY (symbol, date));
CREATE TABLE IF NOT EXISTS idx_days (date TEXT PRIMARY KEY, n INTEGER);
"""


def setup(conn):
    conn.executescript(SCHEMA)
    try:
        conn.execute("ALTER TABLE companies ADD COLUMN tier TEXT")
    except Exception:
        pass
    conn.execute("UPDATE companies SET tier='full' WHERE history=1 AND tier IS NULL")
    conn.commit()


def profiles(conn):
    s = session()
    r = s.get(BASE + "/primary/ListedCompany/GetCompanyProfiles", params={"start": 0, "length": 9999},
              headers={"Referer": PAGE}, timeout=60)
    r.raise_for_status()
    rows = r.json()["data"]
    for x in rows:
        conn.execute("INSERT OR REPLACE INTO idx_companies VALUES (?,?,?,?,?)",
                     (x["KodeEmiten"], x["NamaEmiten"], x.get("Sektor"), x.get("SubSektor"), x.get("PapanPencatatan")))
    conn.commit()
    print(f"[universe] {len(rows)} company profiles", flush=True)


def backfill(conn, start: date = START, end: date | None = None):
    end = end or date.today()
    done = {r[0] for r in conn.execute("SELECT date FROM idx_days")}
    s = session()
    day, n_new = start, 0
    while day <= end:
        d = day.isoformat()
        if day.weekday() < 5 and d not in done:
            for attempt in range(3):
                try:
                    rows = [x for x in _get(s, "/primary/TradingSummary/GetStockSummary", day) if x.get("Volume")]
                    break
                except Exception as e:                      # Cloudflare hiccup: fresh session, retry
                    print(f"[universe] {d}: retry ({e.__class__.__name__})", flush=True)
                    time.sleep(3)
                    s = session()
            else:
                day += timedelta(days=1)
                continue
            for x in rows:
                conn.execute("INSERT OR REPLACE INTO idx_daily VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                             (x["StockCode"], d, x["OpenPrice"] or x["Close"], x["High"] or x["Close"],
                              x["Low"] or x["Close"], x["Close"], x["Volume"], x["Value"],
                              x.get("ForeignBuy") or 0, x.get("ForeignSell") or 0, x.get("ListedShares")))
            if rows:                                       # an empty day is a holiday or not yet published: retry next run
                conn.execute("INSERT OR REPLACE INTO idx_days VALUES (?,?)", (d, len(rows)))
            conn.commit()
            n_new += 1
            if n_new % 20 == 0:
                print(f"[universe] backfilled through {d}", flush=True)
            time.sleep(0.4)
        day += timedelta(days=1)
    print(f"[universe] backfill done: {n_new} new trading days", flush=True)


def _sector_maps(conn):
    """IDX names its sectors in Indonesian, Sectors in English: learn the mapping from stocks in both."""
    votes_sec, votes_sub = defaultdict(Counter), defaultdict(Counter)
    for sektor, subsektor, sector, sub in conn.execute(
            "SELECT i.sektor, i.subsektor, c.sector, c.sub_sector FROM idx_companies i JOIN companies c ON c.symbol=i.symbol "
            "WHERE c.sector IS NOT NULL"):
        votes_sec[sektor][sector] += 1
        votes_sub[subsektor][sub] += 1
    return ({k: v.most_common(1)[0][0] for k, v in votes_sec.items()},
            {k: v.most_common(1)[0][0] for k, v in votes_sub.items()})


def expand(conn, min_value: float = MIN_VALUE):
    sec_map, sub_map = _sector_maps(conn)
    last60 = [r[0] for r in conn.execute("SELECT date FROM idx_days WHERE n > 0 ORDER BY date DESC LIMIT 60")]
    if not last60:
        sys.exit("run backfill first")
    have = {r[0] for r in conn.execute("SELECT symbol FROM companies WHERE history=1")}
    vals = defaultdict(list)
    for sym, v in conn.execute(f"SELECT symbol, value FROM idx_daily WHERE date IN ({','.join('?' * len(last60))})", last60):
        vals[sym].append(v or 0)
    liquid = []
    for sym, v in vals.items():
        v = sorted(v + [0] * (60 - len(v)))
        if sym not in have and len(sym) == 4 and v[30] >= min_value:
            liquid.append(sym)
    prof = {r[0]: r[1:] for r in conn.execute("SELECT symbol, name, sektor, subsektor FROM idx_companies")}
    added = 0
    for sym in liquid:
        name, sektor, subsektor = prof.get(sym, (None, None, None))
        last = conn.execute("SELECT close, listed FROM idx_daily WHERE symbol=? ORDER BY date DESC LIMIT 1", (sym,)).fetchone()
        cap = last[0] * last[1] if last and last[1] else None
        conn.execute(
            "INSERT OR REPLACE INTO companies (symbol, name, sector, sub_sector, industry, market_cap, fundamentals, price_ranges, history, tier) "
            "VALUES (?,?,?,?,?,?,?,?,1,'basic')",
            (sym, name, sec_map.get(sektor, sektor), sub_map.get(subsektor, subsektor), subsektor, cap, json.dumps({}), json.dumps({})))
        for d, o, h, l, c, v, val, fb, fs, listed in conn.execute(
                "SELECT date, open, high, low, close, volume, value, fbuy, fsell, listed FROM idx_daily WHERE symbol=?", (sym,)).fetchall():
            vwap = val / v if v else c
            buy, sell = fb * vwap, fs * vwap
            conn.execute("INSERT OR IGNORE INTO prices VALUES (?,?,?,?,?,?,?,?)", (sym, d, o, h, l, c, v, c * listed if listed else None))
            conn.execute("INSERT OR IGNORE INTO foreign_flow VALUES (?,?,?,?,?,?)",
                         (sym, d, buy - sell, buy, sell, (buy + sell) / (2 * val) if val else None))
        added += 1
    conn.commit()
    total = conn.execute("SELECT COUNT(*) FROM companies WHERE history=1").fetchone()[0]
    print(f"[universe] added {added} liquid stocks (median value ≥ Rp{min_value / 1e9:.0f} miliar); universe now {total}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("step", choices=["profiles", "backfill", "expand", "all"])
    ap.add_argument("--min-value", type=float, default=MIN_VALUE)
    args = ap.parse_args()
    conn = connect()
    setup(conn)
    if args.step in ("profiles", "all"):
        profiles(conn)
    if args.step in ("backfill", "all"):
        backfill(conn)
    if args.step in ("expand", "all"):
        expand(conn, args.min_value)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()

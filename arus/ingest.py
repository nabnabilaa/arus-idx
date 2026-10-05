"""
Ingestion: pull raw Sectors data into a local SQLite warehouse.

Credit strategy:
- Fundamentals for 200 companies in 2 screener calls (include_query_values trick).
- Per-symbol endpoints return a 90-day window for 1 credit and accept past `end` dates,
  so ~1 year of history = 4 windows per symbol.
- History is only pulled for the most liquid names, chosen from the current window.

Usage:
    python -m arus.ingest --dry-run          # estimate credits, fire nothing
    python -m arus.ingest                    # pull everything (cached, resumable)
"""

import argparse
import json
import sqlite3
import sys
from datetime import date, timedelta

from arus import config
from arus.client import SectorsClient

AS_OF = date(2026, 10, 3)          # the last trading day is 2026-10-02 (Fri)
N_WINDOWS = 5                      # 5 × 90 days ≈ 15 months of trading history
N_CANDIDATES = 200                 # companies screened by market cap
N_HISTORY = 120                    # most liquid names that get full history

FUND_FIELDS = ["pe_ttm", "pb_mrq", "ps_ttm", "roe_ttm", "roa_ttm", "der_mrq", "yield_ttm",
               "free_float", "yoy_quarter_earnings_growth", "yoy_quarter_revenue_growth",
               "forward_pe", "intrinsic_value"]
PRICE_FIELDS = ["last_close_price", "daily_close_change", "52_w_high_price",
                "52_w_low_price", "90_d_high_price", "90_d_low_price"]

SCHEMA = """
CREATE TABLE IF NOT EXISTS companies (
    symbol TEXT PRIMARY KEY, name TEXT, sector TEXT, sub_sector TEXT, industry TEXT,
    market_cap REAL, fundamentals TEXT, price_ranges TEXT, history INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS prices (
    symbol TEXT, date TEXT, open REAL, high REAL, low REAL, close REAL, volume REAL,
    market_cap REAL, PRIMARY KEY (symbol, date)
);
CREATE TABLE IF NOT EXISTS foreign_flow (
    symbol TEXT, date TEXT, net REAL, buy REAL, sell REAL, share REAL,
    PRIMARY KEY (symbol, date)
);
CREATE TABLE IF NOT EXISTS index_daily (
    index_code TEXT, date TEXT, price REAL, PRIMARY KEY (index_code, date)
);
CREATE TABLE IF NOT EXISTS corp_actions (
    symbol TEXT, kind TEXT, date TEXT, detail TEXT, PRIMARY KEY (symbol, kind, date)
);
CREATE TABLE IF NOT EXISTS filings (
    symbol TEXT, ts TEXT, holder_type TEXT, transaction_type TEXT, title TEXT, body TEXT,
    source TEXT, PRIMARY KEY (symbol, ts, title)
);
CREATE TABLE IF NOT EXISTS suspensions (
    symbol TEXT, date TEXT, reason TEXT, PRIMARY KEY (symbol, date)
);
CREATE TABLE IF NOT EXISTS brokers (
    code TEXT PRIMARY KEY, name TEXT, is_foreign INTEGER, cohort TEXT
);
CREATE TABLE IF NOT EXISTS broker_daily (
    symbol TEXT, date TEXT, payload TEXT, PRIMARY KEY (symbol, date)
);
CREATE TABLE IF NOT EXISTS broker_top (
    symbol TEXT, start TEXT, end_ TEXT, payload TEXT, PRIMARY KEY (symbol, start, end_)
);
"""


def connect() -> sqlite3.Connection:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(config.WAREHOUSE_DB)
    conn.executescript(SCHEMA)
    return conn


def windows(as_of: date = AS_OF, n: int = N_WINDOWS) -> list[tuple[str, str]]:
    """Non-overlapping 90-day windows ending at as_of, newest first."""
    out = []
    end = as_of
    for _ in range(n):
        start = end - timedelta(days=89)
        out.append((start.isoformat(), end.isoformat()))
        end = start - timedelta(days=1)
    return out


def _bare(symbol: str) -> str:
    return symbol.upper().replace(".JK", "")


# ----------------------------------------------------------------------------
def pull_universe(c: SectorsClient, conn):
    any_fund = " or ".join(f"{f} > -1000000000000" for f in FUND_FIELDS)
    fund = c.get("/v2/companies/", {
        "where": f"market_cap > 1000000000000 and ({any_fund})",
        "order_by": "-market_cap", "limit": N_CANDIDATES, "include_query_values": "true"})
    any_price = " or ".join(f"{f} > -1" for f in PRICE_FIELDS)
    cls = c.get("/v2/companies/", {
        "where": (f"market_cap > 1000000000000 and sub_sector != 'none' and sector != 'none' "
                  f"and industry != 'none' and ({any_price})"),
        "order_by": "-market_cap", "limit": N_CANDIDATES, "include_query_values": "true"})
    if fund is None or cls is None:
        return
    meta = {_bare(r["symbol"]): r for r in cls["results"]}
    for r in fund["results"]:
        sym = _bare(r["symbol"])
        qv = r["query_values"]
        m = meta.get(sym, {}).get("query_values", {})
        conn.execute(
            "INSERT OR REPLACE INTO companies (symbol, name, sector, sub_sector, industry, "
            "market_cap, fundamentals, price_ranges, history) VALUES (?,?,?,?,?,?,?,?, "
            "COALESCE((SELECT history FROM companies WHERE symbol=?),0))",
            (sym, r["company_name"], m.get("sector"), m.get("sub_sector"), m.get("industry"),
             qv.get("market_cap"), json.dumps({f: qv.get(f) for f in FUND_FIELDS}),
             json.dumps({f: m.get(f) for f in PRICE_FIELDS}), sym))
    conn.commit()


def pull_sharia(c: SectorsClient, conn):
    """JII70 membership — the sharia index Sectors exposes (ISSI is not available)."""
    try:
        conn.execute("ALTER TABLE companies ADD COLUMN jii70 INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    body = c.get("/v2/companies/", {"where": "indices in ['JII70'] and market_cap > 1000000000000",
                                    "order_by": "-market_cap", "limit": 200})
    members = [_bare(r["symbol"]) for r in (body or {}).get("results", [])]
    conn.execute("UPDATE companies SET jii70=0")
    conn.executemany("UPDATE companies SET jii70=1 WHERE symbol=?", [(s,) for s in members])
    conn.commit()
    return members


def _store_prices(conn, sym, rows):
    for r in rows or []:
        conn.execute("INSERT OR REPLACE INTO prices VALUES (?,?,?,?,?,?,?,?)",
                     (sym, r["date"], r.get("open"), r.get("high"), r.get("low"),
                      r.get("close"), r.get("volume"), r.get("market_cap")))


def _store_flow(conn, sym, body):
    for r in (body or {}).get("data", []):
        conn.execute("INSERT OR REPLACE INTO foreign_flow VALUES (?,?,?,?,?,?)",
                     (sym, r["date"], r.get("net_foreign_inflow"), r.get("foreign_buy_idr"),
                      r.get("foreign_sell_idr"), r.get("foreign_share")))


def pull_current_prices(c, conn):
    start, end = windows()[0]
    syms = [r[0] for r in conn.execute(
        "SELECT symbol FROM companies ORDER BY market_cap DESC LIMIT ?", (N_CANDIDATES,))]
    for s in syms:
        _store_prices(conn, s, c.get(f"/v2/daily/{s}/", {"start": start, "end": end}))
    conn.commit()


def select_history_universe(conn) -> list[str]:
    """Most liquid names by median daily traded value over the current window."""
    start, end = windows()[0]
    rows = conn.execute(
        "SELECT symbol, close*volume FROM prices WHERE date BETWEEN ? AND ?",
        (start, end)).fetchall()
    by = {}
    for s, tv in rows:
        if tv is not None:
            by.setdefault(s, []).append(tv)
    med = {s: sorted(v)[len(v) // 2] for s, v in by.items() if len(v) >= 30}
    chosen = sorted(med, key=med.get, reverse=True)[:N_HISTORY]
    conn.execute("UPDATE companies SET history=0")
    conn.executemany("UPDATE companies SET history=1 WHERE symbol=?", [(s,) for s in chosen])
    conn.commit()
    return chosen


def pull_history(c, conn, symbols):
    wins = windows()
    for s in symbols:
        for i, (start, end) in enumerate(wins):
            if i > 0:
                _store_prices(conn, s, c.get(f"/v2/daily/{s}/", {"start": start, "end": end}))
            _store_flow(conn, s, c.get(f"/v2/foreign-flow/{s}/", {"start": start, "end": end}))
        conn.commit()


def pull_market(c, conn):
    for start, end in windows():
        for row in c.get("/v2/index-daily/ihsg/", {"start": start, "end": end}) or []:
            conn.execute("INSERT OR REPLACE INTO index_daily VALUES (?,?,?)",
                         ("IHSG", row["date"], row["price"]))
        _store_flow(conn, "IHSG", c.get("/v2/foreign-flow/IHSG/", {"start": start, "end": end}))
    conn.commit()


def pull_corporate_actions(c, conn):
    first = windows()[-1][0]
    for kind in ("stock_split", "right_issue"):
        body = c.get("/v2/corporate-actions/", {"start": first, "end": AS_OF.isoformat(),
                                                "type": kind})
        for r in (body or {}).get(kind, []):
            d = r.get("ex_date") or r.get("date")
            conn.execute("INSERT OR REPLACE INTO corp_actions VALUES (?,?,?,?)",
                         (_bare(r["symbol"]), kind, d, json.dumps(r)))
    conn.commit()


def pull_context(c, conn):
    """Non-historical evidence: insider filings, suspensions, broker registry."""
    since = (AS_OF - timedelta(days=90)).isoformat()
    for ttype in ("buy", "sell"):
        offset = 0
        while offset < 150:
            body = c.get("/v2/filings/", {"start": since, "end": AS_OF.isoformat(),
                                          "transaction_type": ttype, "limit": 30,
                                          "offset": offset})
            res = (body or {}).get("results", [])
            for r in res:
                conn.execute("INSERT OR REPLACE INTO filings VALUES (?,?,?,?,?,?,?)",
                             (_bare(r.get("symbol", "")), r.get("timestamp"),
                              r.get("holder_type"), ttype, r.get("title"), r.get("body"),
                              r.get("source")))
            if not (body or {}).get("pagination", {}).get("has_next"):
                break
            offset += 30
    body = c.get("/v2/suspensions/", {"start": since, "end": AS_OF.isoformat(), "limit": 100})
    for r in (body or {}).get("results", []):
        conn.execute("INSERT OR REPLACE INTO suspensions VALUES (?,?,?)",
                     (_bare(r["symbol"]), r["suspension_date"], r.get("reason")))
    for r in c.get("/v2/brokers/") or []:
        conn.execute("INSERT OR REPLACE INTO brokers VALUES (?,?,?,?)",
                     (r["code"], r.get("name"), int(bool(r.get("is_foreign"))),
                      r.get("cohort")))
    conn.commit()


def last_date(conn) -> str | None:
    row = conn.execute("SELECT MAX(date) FROM prices").fetchone()
    return row[0] if row else None


def pull_increment(c: SectorsClient, conn, end: date) -> dict:
    """
    Append trading days after the warehouse's last date, as cheaply as the API allows:
    per-symbol daily OHLCV for the history universe (1 credit each, any window ≤ 90 days)
    plus the full-universe foreign-flow feed (1 credit per 30 tickers per day).
    """
    since = last_date(conn)
    if since is None or since >= end.isoformat():
        return {"new_days": 0}
    start = (date.fromisoformat(since) + timedelta(days=1)).isoformat()
    syms = [r[0] for r in conn.execute("SELECT symbol FROM companies WHERE history=1")]
    for s in syms:
        _store_prices(conn, s, c.get(f"/v2/daily/{s}/", {"start": start, "end": end.isoformat()}, refresh=True))
    conn.commit()
    new_days = sorted({r[0] for r in conn.execute("SELECT DISTINCT date FROM prices WHERE date > ?", (since,))})
    wanted = set(syms) | {"IHSG"}
    for d in new_days:
        offset = 0
        while True:
            body = c.get("/v2/foreign-flow/", {"date": d, "limit": 30, "offset": offset})
            res = (body or {}).get("results", [])
            for r in res:
                sym = _bare(r.get("symbol", ""))
                if sym in wanted:
                    conn.execute("INSERT OR REPLACE INTO foreign_flow VALUES (?,?,?,?,?,?)",
                                 (sym, d, r.get("net_foreign_inflow"), r.get("foreign_buy_idr"),
                                  r.get("foreign_sell_idr"), r.get("foreign_share")))
            if not (body or {}).get("pagination", {}).get("has_next"):
                break
            offset += 30
    for row in c.get("/v2/index-daily/ihsg/", {"start": start, "end": end.isoformat()}, refresh=True) or []:
        conn.execute("INSERT OR REPLACE INTO index_daily VALUES (?,?,?)", ("IHSG", row["date"], row["price"]))
    _store_flow(conn, "IHSG", c.get("/v2/foreign-flow/IHSG/", {"start": start, "end": end.isoformat()}, refresh=True))
    conn.commit()
    return {"new_days": len(new_days), "days": new_days}


def pull_broker_daily(c, conn, symbols, end: date | None = None, days: int = 14):
    """Every broker's buy/sell per day for the last `days` calendar days (1 credit per stock)."""
    end = end or AS_OF
    start = (end - timedelta(days=days - 1)).isoformat()
    for s in symbols:
        body = c.get(f"/v2/broker-summary/{s}/", {"start": start, "end": end.isoformat()})
        for day in (body or {}).get("data", []):
            conn.execute("INSERT OR REPLACE INTO broker_daily VALUES (?,?,?)", (s, day["date"], json.dumps(day["summary"])))
    conn.commit()


def pull_broker_top(c, conn, symbols, days: int = 20):
    """Aggregate top buyers/sellers over the last `days` calendar days (2 credits each)."""
    start = (AS_OF - timedelta(days=days)).isoformat()
    for s in symbols:
        body = c.get(f"/v2/broker-summary/{s}/top/", {"start": start, "end": AS_OF.isoformat(),
                                                       "n_brokers": 10})
        if body:
            conn.execute("INSERT OR REPLACE INTO broker_top VALUES (?,?,?,?)",
                         (s, start, AS_OF.isoformat(), json.dumps(body)))
    conn.commit()


FIN_FIELDS = ["revenue", "gross_profit", "earnings", "total_assets", "total_liabilities", "total_equity",
              "current_assets", "current_liabilities", "operating_cash_flow", "free_cash_flow",
              "total_debt", "outstanding_shares", "total_dividend"]
FIN_YEARS = [2021, 2022, 2023, 2024, 2025]


def pull_financials_for(c: SectorsClient, conn, symbols: list[str], batch: int = 63):
    """Same statements for an explicit list (e.g. stocks added from the IDX summary), in symbol batches
    small enough to keep the request line under 4 KB; all fields and years in one call per batch."""
    try:
        conn.execute("ALTER TABLE companies ADD COLUMN financials TEXT")
    except sqlite3.OperationalError:
        pass
    any_ = " or ".join(f"{f}[{y}] != 0" for f in FIN_FIELDS for y in FIN_YEARS)
    got = 0
    for i in range(0, len(symbols), batch):
        part = symbols[i:i + batch]
        listed = ",".join(f"'{s}.JK'" for s in part)
        body = c.get("/v2/companies/", {"where": f"symbol in [{listed}] and ({any_})",
                                        "limit": len(part), "include_query_values": "true"})
        for r in (body or {}).get("results", []):
            qv = r["query_values"]
            fin = {f: {str(y): qv.get(f"{f}[{y}]") for y in FIN_YEARS} for f in FIN_FIELDS}
            conn.execute("UPDATE companies SET financials=? WHERE symbol=?", (json.dumps(fin), _bare(r["symbol"])))
            got += 1
        conn.commit()
    print(f"[ingest] financials for {got}/{len(symbols)} listed companies", flush=True)


def pull_financials(c: SectorsClient, conn):
    """Five years of annual statements for the whole universe in two screener calls: every
    `field[year]` named in the where-clause comes back through include_query_values."""
    try:
        conn.execute("ALTER TABLE companies ADD COLUMN financials TEXT")
    except sqlite3.OperationalError:
        pass
    wanted = {r[0] for r in conn.execute("SELECT symbol FROM companies WHERE history=1")}
    fin: dict[str, dict] = {}
    for part in (FIN_FIELDS[:7], FIN_FIELDS[7:]):           # two calls keep the request line under 4 KB
        any_ = " or ".join(f"{f}[{y}] != 0" for f in part for y in FIN_YEARS)
        body = c.get("/v2/companies/", {"where": f"market_cap > 1000000000000 and ({any_})",
                                        "order_by": "-market_cap", "limit": N_CANDIDATES,
                                        "include_query_values": "true"})
        for r in (body or {}).get("results", []):
            sym = _bare(r["symbol"])
            if sym in wanted:
                qv = r["query_values"]
                fin.setdefault(sym, {}).update({f: {str(y): qv.get(f"{f}[{y}]") for y in FIN_YEARS} for f in part})
    for sym, d in fin.items():
        conn.execute("UPDATE companies SET financials=? WHERE symbol=?", (json.dumps(d), sym))
    conn.commit()
    print(f"[ingest] financials for {len(fin)}/{len(wanted)} companies", flush=True)


def pull_news(c: SectorsClient, conn, start: str, end: str, pages: int = 4):
    """Recent IDX news that mentions any ranked stock: 30 articles per page, 1 credit per page."""
    conn.execute("""CREATE TABLE IF NOT EXISTS news (
        url TEXT PRIMARY KEY, ts TEXT, title TEXT, body TEXT, thumbnail TEXT, symbols TEXT, tags TEXT)""")
    syms = [r[0] for r in conn.execute("SELECT symbol FROM companies WHERE history=1 ORDER BY market_cap DESC")]
    for page in range(pages):
        body = c.get("/v2/news/", {"symbols": ",".join(syms), "start": start, "end": end,
                                   "limit": 30, **({"offset": page * 30} if page else {})})
        items = (body or {}).get("results", [])
        for n in items:
            conn.execute("INSERT OR REPLACE INTO news VALUES (?,?,?,?,?,?,?)",
                         (n.get("source"), n.get("timestamp"), n.get("title"), n.get("body"), n.get("thumbnail"),
                          json.dumps([_bare(x) for x in n.get("symbols") or []]), json.dumps(n.get("tags") or [])))
        conn.commit()
        if len(items) < 30:
            break


# ----------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--cap", type=float, default=1200)
    ap.add_argument("--step", default="all",
                    choices=["all", "universe", "current", "history", "market", "context",
                             "sharia", "financials"])
    args = ap.parse_args()

    c = SectorsClient(dry_run=args.dry_run, credit_cap=args.cap)
    conn = connect()
    steps = ["universe", "current", "history", "market", "context"] \
        if args.step == "all" else [args.step]

    for step in steps:
        if step == "universe":
            pull_universe(c, conn)
        elif step == "current":
            pull_current_prices(c, conn)
        elif step == "history":
            syms = select_history_universe(conn)
            if args.dry_run and not syms:
                c.would_spend += N_HISTORY * (2 * N_WINDOWS - 1)
            else:
                pull_history(c, conn, syms)
        elif step == "market":
            pull_market(c, conn)
            pull_corporate_actions(c, conn)
        elif step == "context":
            pull_context(c, conn)
            pull_sharia(c, conn)
        elif step == "sharia":
            pull_sharia(c, conn)
        elif step == "financials":
            pull_financials(c, conn)
        print(f"[ingest] {step} done · {c.summary()}", flush=True)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()

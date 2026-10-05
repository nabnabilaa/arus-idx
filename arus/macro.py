"""
Global & macro layer: what moves IDX stocks from outside the IDX.

Sources (public, keyless):
  - FRED (Federal Reserve Bank of St. Louis) CSV: S&P 500, VIX, Brent crude, broad US dollar
    index, US 10-year Treasury yield
  - Frankfurter (European Central Bank reference rates): USD/IDR

Everything is lagged one IDX session in the feature engine: US markets and the ECB fixing
close after the IDX does, so day-t values are only known by the IDX open of day t+1.

    python -m arus.macro            # fetch / refresh into data/warehouse.db (table: macro)
"""

import io
import sqlite3
import sys
import time
from datetime import date

import pandas as pd
import requests

from arus import config

START = "2025-06-01"

FRED = {
    "spx": "SP500",          # S&P 500 index
    "vix": "VIXCLS",         # CBOE volatility index
    "oil": "DCOILBRENTEU",   # Brent crude, USD/bbl
    "usd": "DTWEXBGS",       # broad trade-weighted US dollar index
    "us10y": "DGS10",        # US 10-year Treasury yield, %
}

LABELS = {
    "idr": ("USD/IDR", "Kurs dolar terhadap rupiah (naik = rupiah melemah)"),
    "spx": ("S&P 500", "Indeks saham utama Amerika"),
    "vix": ("VIX", "Indeks ketakutan pasar global"),
    "oil": ("Brent", "Harga minyak mentah dunia"),
    "usd": ("Dolar AS", "Kekuatan dolar terhadap mata uang dunia"),
    "us10y": ("Yield AS 10th", "Imbal hasil obligasi pemerintah AS 10 tahun"),
}


def _connect():
    conn = sqlite3.connect(config.WAREHOUSE_DB)
    conn.execute("CREATE TABLE IF NOT EXISTS macro (series TEXT, date TEXT, value REAL, PRIMARY KEY (series, date))")
    return conn


def fetch_fred(key: str, sid: str) -> pd.Series:
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}&cosd={START}"
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    df = pd.read_csv(io.StringIO(r.text))
    df.columns = ["date", "value"]
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    return df.dropna().set_index("date")["value"].rename(key)


def fetch_idr() -> pd.Series:
    url = f"https://api.frankfurter.dev/v1/{START}..{date.today().isoformat()}"
    r = requests.get(url, params={"base": "USD", "symbols": "IDR"}, timeout=60)
    r.raise_for_status()
    rates = r.json()["rates"]
    return pd.Series({d: v["IDR"] for d, v in rates.items()}, name="idr").sort_index()


def refresh() -> dict:
    conn = _connect()
    got = {}
    for key, sid in FRED.items():
        try:
            s = fetch_fred(key, sid)
        except requests.RequestException as e:
            print(f"[macro] {key}: {e}")
            continue
        conn.executemany("INSERT OR REPLACE INTO macro VALUES (?,?,?)", [(key, d, float(v)) for d, v in s.items()])
        got[key] = (len(s), s.index[-1])
        time.sleep(0.5)
    try:
        s = fetch_idr()
        conn.executemany("INSERT OR REPLACE INTO macro VALUES (?,?,?)", [("idr", d, float(v)) for d, v in s.items()])
        got["idr"] = (len(s), s.index[-1])
    except requests.RequestException as e:
        print(f"[macro] idr: {e}")
    conn.commit()
    return got


def load(conn: sqlite3.Connection | None = None) -> pd.DataFrame:
    """Wide frame: one column per macro series, indexed by its own calendar date."""
    conn = conn or _connect()
    try:
        df = pd.read_sql("SELECT series, date, value FROM macro", conn)
    except Exception:
        return pd.DataFrame()
    if df.empty:
        return df
    return df.pivot(index="date", columns="series", values="value").sort_index()


def factor_changes(macro: pd.DataFrame, dates: pd.Index) -> pd.DataFrame:
    """
    Daily factor moves aligned to IDX sessions, lagged one session (causal).
    Log changes for prices/FX, plain differences for VIX and yields.
    """
    if macro.empty:
        return pd.DataFrame(index=dates)
    full = macro.reindex(sorted(set(macro.index) | set(dates))).ffill()
    lv = full.reindex(dates)
    import numpy as np
    out = pd.DataFrame(index=dates)
    for k in lv.columns:
        if k in ("vix", "us10y"):
            out[k] = lv[k].diff()
        else:
            out[k] = np.log(lv[k]).diff()
    return out.shift(1)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    for k, (n, last) in refresh().items():
        print(f"[macro] {k:6s} {n:4d} rows, last {last}")


COMMODITIES = {"coal": "Coal", "nickel": "Nickel", "gold": "Gold", "copper": "Copper"}


def pull_commodities(c, start_year: int, end_year: int):
    """Monthly (bi-weekly for recent coal) USD prices from Sectors' mining data, 1 credit each."""
    for name in COMMODITIES.values():
        c.get(f"/v2/mining/commodities/{name}/price/", {"start_year": start_year, "end_year": end_year})


def commodity_prices(cache_db=config.CACHE_DB) -> dict:
    """Latest cached price series per commodity: last value, change vs the previous print, recent points."""
    import json
    out = {}
    con = sqlite3.connect(cache_db)
    for key, name in COMMODITIES.items():
        rows = {}
        for (body,) in con.execute("SELECT body FROM responses WHERE path = ? AND status = 200",
                                   (f"/v2/mining/commodities/{name}/price/",)):
            for r in json.loads(body) or []:
                if r.get("date") and r.get("price_usd_per_ton") is not None:
                    rows[r["date"]] = float(r["price_usd_per_ton"])
        if len(rows) < 2:
            continue
        dates = sorted(rows)
        last, prev = rows[dates[-1]], rows[dates[-2]]
        year_ago = next((rows[d] for d in reversed(dates) if d <= f"{int(dates[-1][:4]) - 1}{dates[-1][4:]}"), None)
        out[key] = {"last": last, "date": dates[-1], "prev_date": dates[-2], "chg": last / prev - 1,
                    "chg_y": (last / year_ago - 1) if year_ago else None,
                    "series": {"date": dates[-18:], "v": [rows[d] for d in dates[-18:]]}}
    con.close()
    return out

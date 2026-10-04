"""
Financial health: a rule-based read of each company's annual statements, for people who hold
for weeks or years rather than a day.

Nine checks adapted from Piotroski's F-score (2000), comparing the latest full year with the
one before: profitability (profit, operating cash, rising ROA, cash backing the profit),
balance sheet (falling leverage, rising liquidity, no dilution) and efficiency (rising gross
margin and asset turnover). Checks that don't apply to a business model — gross margin and
current ratio for banks — are skipped rather than failed, so the score is "x of n".

This is a description of financial condition, not a return forecast: Arus has only one year of
price history, too short to test what these checks do to future prices.
"""

import json
import sqlite3

import numpy as np

YEARS = ["2021", "2022", "2023", "2024", "2025"]


def _v(fin: dict, field: str, year: str):
    x = (fin.get(field) or {}).get(year)
    return float(x) if x is not None and np.isfinite(x) else None


def _ratio(a, b):
    return a / b if a is not None and b not in (None, 0) else None


def _cagr(first, last, years):
    if first is None or last is None or first <= 0 or last <= 0 or years <= 0:
        return None
    return (last / first) ** (1 / years) - 1


def assess(fin: dict) -> dict | None:
    years = [y for y in YEARS if _v(fin, "revenue", y) is not None or _v(fin, "earnings", y) is not None]
    if len(years) < 2:
        return None
    y, p = years[-1], years[-2]
    g = lambda f, yr: _v(fin, f, yr)

    roa = lambda yr: _ratio(g("earnings", yr), g("total_assets", yr))
    lev = lambda yr: _ratio(g("total_liabilities", yr), g("total_assets", yr))
    cur = lambda yr: _ratio(g("current_assets", yr), g("current_liabilities", yr))
    gm = lambda yr: _ratio(g("gross_profit", yr), g("revenue", yr))
    turn = lambda yr: _ratio(g("revenue", yr), g("total_assets", yr))

    def cmp(a, b, higher=True):
        if a is None or b is None:
            return None
        return bool(a > b) if higher else bool(a < b)

    sh_y, sh_p = g("outstanding_shares", y), g("outstanding_shares", p)
    # (key, passed, evidence before, evidence after, unit) — the evidence lets the page show the numbers
    checks = [
        ("profit", None if g("earnings", y) is None else g("earnings", y) > 0, g("earnings", p), g("earnings", y), "idr"),
        ("cash", None if g("operating_cash_flow", y) is None else g("operating_cash_flow", y) > 0,
         g("operating_cash_flow", p), g("operating_cash_flow", y), "idr"),
        ("roa_up", cmp(roa(y), roa(p)), roa(p), roa(y), "pct"),
        ("cash_backed", None if g("operating_cash_flow", y) is None or g("earnings", y) is None
         else g("operating_cash_flow", y) > g("earnings", y), g("earnings", y), g("operating_cash_flow", y), "idr"),
        ("leverage_down", cmp(lev(y), lev(p), higher=False), lev(p), lev(y), "pct"),
        ("liquidity_up", cmp(cur(y), cur(p)), cur(p), cur(y), "x"),
        ("no_dilution", None if sh_y is None or sh_p is None else sh_y <= sh_p * 1.01, sh_p, sh_y, "shares"),
        ("margin_up", cmp(gm(y), gm(p)), gm(p), gm(y), "pct"),
        ("turnover_up", cmp(turn(y), turn(p)), turn(p), turn(y), "x"),
    ]
    done = [(k, bool(v), a, b, u) for k, v, a, b, u in checks if v is not None]
    if len(done) < 5:
        return None
    score, n = sum(v for _, v, *_ in done), len(done)
    share = score / n
    grade = "strong" if share >= 7 / 9 else "fair" if share >= 4 / 9 else "weak"

    first = years[0]
    span = int(y) - int(first)
    profitable = sum(1 for yr in years if (g("earnings", yr) or 0) > 0)
    return {
        "year": y, "prev": p, "score": score, "n": n, "grade": grade,
        "checks": [{"k": k, "ok": v, "a": a, "b": b, "u": u} for k, v, a, b, u in done],
        "series": {f: [g(f, yr) for yr in years] for f in
                   ("revenue", "gross_profit", "earnings", "operating_cash_flow", "free_cash_flow",
                    "total_assets", "total_liabilities", "total_equity", "total_debt", "total_dividend")},
        "years": years,
        "rev_cagr": _cagr(g("revenue", first), g("revenue", y), span),
        "eps_cagr": _cagr(g("earnings", first), g("earnings", y), span),
        "profitable_years": profitable,
        "net_margin": _ratio(g("earnings", y), g("revenue", y)),
        "roa": roa(y), "leverage": lev(y), "current_ratio": cur(y),
        "dividend_years": sum(1 for yr in years if (g("total_dividend", yr) or 0) > 0),
    }


def load(conn: sqlite3.Connection) -> dict[str, dict]:
    cols = [r[1] for r in conn.execute("PRAGMA table_info(companies)")]
    if "financials" not in cols:
        return {}
    out = {}
    for sym, raw in conn.execute("SELECT symbol, financials FROM companies WHERE financials IS NOT NULL"):
        a = assess(json.loads(raw))
        if a:
            out[sym] = a
    return out

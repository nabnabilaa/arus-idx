"""Insider filings, agenda and weekly recap: the classification and arithmetic behind those pages."""

import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

import pandas as pd

from arus import agenda, insider, weekly

DATES = [d.strftime("%Y-%m-%d") for d in pd.bdate_range("2026-08-03", periods=40)]


def warehouse(prices: dict[str, list[float]], path: Path) -> sqlite3.Connection:
    """A minimal warehouse: the IDX daily table for the given closes (flat volume and value)."""
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE idx_daily (symbol, date, open, high, low, close, volume, value, fbuy, fsell, listed)")
    for sym, closes in prices.items():
        for d, c in zip(DATES, closes):
            conn.execute("INSERT INTO idx_daily VALUES (?,?,?,?,?,?,?,?,?,?,?)", (sym, d, c, c, c, c, 1e6, c * 1e6, 0, 0, None))
    conn.commit()
    return conn


def cache(path: Path, filings: list[dict] = (), actions: dict | None = None) -> Path:
    """A response cache holding one /v2/filings/ page and optionally one calendar page."""
    con = sqlite3.connect(path)
    con.execute("CREATE TABLE responses (key, path, params, status, body, fetched_at)")
    con.execute("INSERT INTO responses VALUES ('f', '/v2/filings/', '{}', 200, ?, '')", (json.dumps({"results": list(filings)}),))
    if actions:
        con.execute("INSERT INTO responses VALUES ('c', '/v2/corporate-actions/', '{}', 200, ?, '')", (json.dumps(actions),))
    con.commit()
    con.close()
    return path


def filing(sym, holder, side, ts, sh, px, pb=10.0, pa=10.1, tags=()):
    return {"symbol": f"{sym}.JK", "timestamp": ts, "holder_name": holder, "holder_type": "insider", "transaction_type": side,
            "amount_transaction": sh, "price": px, "transaction_value": sh * px, "share_percentage_before": pb,
            "share_percentage_after": pa, "tags": list(tags), "source": "x.pdf", "price_transaction": [{"date": ts[:10], "price": px, "amount_transacted": sh}]}


class InsiderBook(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())

    def build(self, filings, prices=None):
        conn = warehouse(prices or {"AAAA": [100.0] * 40, "BBBB": [100.0] * 40}, self.tmp / "w.db")
        return insider.build(conn, {}, cache_db=cache(self.tmp / "c.db", filings))

    def test_filing_after_the_close_counts_from_the_next_session(self):
        self.assertEqual(insider._entry_index(DATES, f"{DATES[3]}T17:30:00"), 4)
        self.assertEqual(insider._entry_index(DATES, f"{DATES[3]}T10:00:00"), 3)

    def test_corrupt_price_is_dropped_from_sums(self):
        b = self.build([filing("AAAA", "X", "buy", f"{DATES[5]}T10:00:00", 1000, 73_000_000_000.0)])
        e = b["events"][0]
        self.assertTrue(e["bad"])
        self.assertIsNone(e["val"])
        self.assertFalse(e["market"])

    def test_repo_pledge_and_block_transfer_are_not_market_trades(self):
        b = self.build([
            filing("AAAA", "Repo", "buy", f"{DATES[5]}T10:00:00", 1000, 100, tags=["repurchase-agreement"]),
            filing("AAAA", "Seller", "sell", f"{DATES[6]}T10:00:00", 5000, 100),
            filing("AAAA", "Buyer", "buy", f"{DATES[7]}T10:00:00", 5000, 100),
            filing("BBBB", "Big", "buy", f"{DATES[8]}T10:00:00", 100, 100, pb=10.0, pa=40.0),
            filing("BBBB", "Small", "buy", f"{DATES[9]}T10:00:00", 100, 100),
        ])
        market = {e["holder"] for e in b["events"] if e["market"]}
        self.assertEqual(market, {"Small"})

    def test_repeated_buys_by_one_holder_form_a_chain_with_their_average_price(self):
        b = self.build([
            filing("AAAA", "Owner", "buy", f"{DATES[d]}T10:00:00", 100, px) for d, px in ((5, 90.0), (10, 110.0), (15, 100.0))
        ])
        (c,) = b["chains"]
        self.assertEqual((c["holder"], c["n"], round(c["avg"], 6)), ("Owner", 3, 100.0))
        self.assertAlmostEqual(c["vs"], 0.0)

    def test_a_holder_trading_both_ways_is_flagged_and_left_out_of_chains(self):
        b = self.build([
            filing("AAAA", "Broker", side, f"{DATES[d]}T10:00:00", 100 + d, 100) for d, side in ((5, "buy"), (6, "sell"), (7, "buy"))
        ])
        self.assertTrue(all(e["twoway"] for e in b["events"]))
        self.assertEqual(b["chains"], [])


class Agenda(unittest.TestCase):
    def test_ex_dividend_move_and_recovery(self):
        closes = pd.DataFrame({"AAAA": [100.0] * 10 + [96.0, 97.0, 100.0] + [100.0] * 27}, index=DATES)
        divs = pd.DataFrame([{"type": "dividend", "s": "AAAA", "date": DATES[10], "raw": {"dividend_amount": 4.0}}])
        summary, by_stock = agenda.ex_dividend_study(divs, closes)
        self.assertAlmostEqual(summary["yield_med"], 0.04)
        self.assertAlmostEqual(summary["move_med"], -0.04)
        self.assertAlmostEqual(summary["drop_ratio_med"], 1.0)
        self.assertEqual(by_stock["AAAA"][0]["recovered"], 2)

    def test_upcoming_rights_issue_reports_dilution_and_discount(self):
        tmp = Path(tempfile.mkdtemp())
        conn = warehouse({"AAAA": [200.0] * 40}, tmp / "w.db")
        actions = {"right_issue": [{"symbol": "AAAA.JK", "ex_date": "2026-12-01", "cum_date": "2026-11-30", "price": 100.0, "old_ratio": 3.0, "new_ratio": 1.0}]}
        b = agenda.build(conn, DATES[-1], {}, cache_db=cache(tmp / "c.db", actions=actions))
        (it,) = b["upcoming"]
        self.assertEqual(it["type"], "right_issue")
        self.assertAlmostEqual(it["dilution"], 0.25)
        self.assertAlmostEqual(it["discount"], -0.5)


class WeeklyReads(unittest.TestCase):
    def stats(self, **over):
        st = {"ihsg": 0.02, "big_med": 0.01, "big_up": 30, "big_n": 45, "up": 500, "down": 200, "foreign": 2e12,
              "best_sector": {"sector": "Energi", "ret": 0.03, "n": 50, "up": 0.7}, "worst_sector": {"sector": "Teknologi", "ret": -0.01, "n": 40, "up": 0.4}, "n_cooling": 0}
        st.update(over)
        return st

    def test_a_strong_week_reads_mostly_supportive(self):
        r = weekly.reads(self.stats(), {"buy": 0, "sell": 0})
        self.assertGreaterEqual(len(r["pos"]), 4)
        self.assertTrue(any("IHSG naik 2,0%" in x["id"] for x in r["pos"]))

    def test_a_falling_week_never_prints_a_double_minus(self):
        r = weekly.reads(self.stats(ihsg=-0.033, up=200, down=500, foreign=-3.9e12), {"buy": 0, "sell": 0})
        text = " ".join(x["id"] for x in r["neg"])
        self.assertIn("IHSG turun 3,3%", text)
        self.assertIn("Asing jual bersih Rp3,90 T", text)
        self.assertNotIn("--", text)


if __name__ == "__main__":
    unittest.main()

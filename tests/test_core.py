"""Checks on the pieces whose numbers end up on screen: run with `python -m unittest discover tests`."""

import unittest

import numpy as np

from arus import financial
from arus.agent import watch_alerts
from arus.model import auc, platt_apply, platt_fit


def statements(**over):
    """Two healthy years for an ordinary (non-bank) company; override any field per test."""
    base = {
        "revenue": {"2024": 1000.0, "2025": 1200.0},
        "gross_profit": {"2024": 300.0, "2025": 400.0},
        "earnings": {"2024": 100.0, "2025": 150.0},
        "total_assets": {"2024": 2000.0, "2025": 2100.0},
        "total_liabilities": {"2024": 1000.0, "2025": 900.0},
        "total_equity": {"2024": 1000.0, "2025": 1200.0},
        "current_assets": {"2024": 500.0, "2025": 700.0},
        "current_liabilities": {"2024": 400.0, "2025": 400.0},
        "operating_cash_flow": {"2024": 120.0, "2025": 200.0},
        "free_cash_flow": {"2024": 50.0, "2025": 90.0},
        "total_debt": {"2024": 300.0, "2025": 250.0},
        "outstanding_shares": {"2024": 10.0, "2025": 10.0},
        "total_dividend": {"2024": 5.0, "2025": 6.0},
    }
    base.update(over)
    return base


class FinancialHealth(unittest.TestCase):
    def test_all_nine_checks_pass_for_an_improving_company(self):
        a = financial.assess(statements())
        self.assertEqual((a["score"], a["n"], a["grade"]), (9, 9, "strong"))
        self.assertEqual((a["year"], a["prev"]), ("2025", "2024"))

    def test_bank_style_statements_skip_margin_and_liquidity(self):
        a = financial.assess(statements(gross_profit={}, current_assets={}, current_liabilities={}))
        self.assertEqual(a["n"], 7)
        self.assertNotIn("margin_up", [c["k"] for c in a["checks"]])

    def test_a_loss_with_dilution_fails_those_checks_and_shows_the_numbers(self):
        a = financial.assess(statements(earnings={"2024": 100.0, "2025": -50.0}, outstanding_shares={"2024": 10.0, "2025": 12.0}))
        checks = {c["k"]: c for c in a["checks"]}
        self.assertFalse(checks["profit"]["ok"])
        self.assertFalse(checks["no_dilution"]["ok"])
        self.assertEqual((checks["profit"]["a"], checks["profit"]["b"]), (100.0, -50.0))
        self.assertLess(a["score"], 9)

    def test_too_little_history_returns_nothing(self):
        self.assertIsNone(financial.assess({"revenue": {"2025": 1.0}}))


class Calibration(unittest.TestCase):
    def test_auc_is_one_for_a_perfect_ranking_and_half_for_ties(self):
        y = np.array([0, 0, 1, 1])
        self.assertEqual(auc(np.array([0.1, 0.2, 0.8, 0.9]), y), 1.0)
        self.assertEqual(auc(np.array([0.5, 0.5, 0.5, 0.5]), y), 0.5)

    def test_platt_curve_never_turns_the_ranking_upside_down(self):
        rng = np.random.default_rng(0)
        q = rng.random(4000)
        y = (rng.random(4000) < 0.6 - 0.2 * q).astype(float)   # higher rank -> lower win rate
        w = platt_fit(q, y)
        self.assertEqual(w[1], 0.0)                             # collapses to the flat base rate
        p = platt_apply(w, np.array([0.1, 0.9]))
        self.assertAlmostEqual(p[0], p[1])
        self.assertAlmostEqual(p[0], y.mean(), places=3)

    def test_platt_curve_rises_when_the_ranking_works(self):
        rng = np.random.default_rng(1)
        q = rng.random(4000)
        y = (rng.random(4000) < 0.4 + 0.2 * q).astype(float)
        p = platt_apply(platt_fit(q, y), np.array([0.1, 0.9]))
        self.assertGreater(p[1], p[0])


class WatchAlerts(unittest.TestCase):
    def bundle(self, **stock):
        s = {"symbol": "TEST", "price": 1000, "ret_1": 0.01, "z_foreign": 0, "z_volume": 0, "z_return": 0,
             "ff_today": 0, "vol_mult": 1, "invalidate": 900, "support_20": 950, "resistance_20": 1100}
        s.update(stock)
        return {"ranking": [s], "brokerSummary": {}}

    def test_quiet_day_has_no_alerts(self):
        self.assertEqual(watch_alerts(self.bundle(), None, "TEST"), [])

    def test_heavy_foreign_buying_and_a_level_break_are_reported(self):
        out = watch_alerts(self.bundle(z_foreign=4, ff_today=5e9, price=1150), None, "TEST")
        self.assertTrue(any("asing borong" in a for a in out))
        self.assertTrue(any("batas atas" in a for a in out))

    def test_broker_tilt_flip_is_detected_against_yesterday(self):
        def summary(buy, sell):
            return {"brokerSummary": {"TEST": {"5": {"top5_buy": buy, "top5_sell": sell}}}}
        today = {**self.bundle(), **summary(30, 70)}
        yesterday = summary(70, 30)
        self.assertTrue(any("berbalik" in a for a in watch_alerts(today, yesterday, "TEST")))

    def test_unknown_symbol_is_silent(self):
        self.assertEqual(watch_alerts(self.bundle(), None, "NOPE"), [])


if __name__ == "__main__":
    unittest.main()

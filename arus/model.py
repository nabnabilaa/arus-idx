"""
Calibration engine: turn ranked features into an honest probability, per horizon.

Pipeline (run separately for each horizon, e.g. 1 and 20 trading days):
  1. Label: did the stock finish above the median liquid stock over the next H days?
     Beating IHSG was tried first and dropped: its base rate swings 44–58% between periods
     with the fate of a few index heavyweights, which no cross-sectional signal can know.
  2. L2-regularised logistic regression on cross-sectional feature ranks; the penalty is
     chosen by nested validation inside each training window.
  3. Purged walk-forward: each 20-day test block is predicted by a model trained only on
     dates whose H-day labels had resolved before the block began.
  4. A Platt curve fitted on the within-day rank of out-of-sample scores maps rank →
     empirical win probability. Isotonic regression was tried and dropped: it overfit the
     tails (0% and 74% at the extremes).

Pure numpy on purpose: transparent, dependency-light, deployable anywhere.
"""

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from arus.features import FEATURES, FEATURE_NAMES

TEST_BLOCK = 20
MIN_TRAIN_DATES = 40
L2_GRID = (3.0, 30.0, 100.0, 300.0, 1000.0)
HORIZONS = (1, 20)


# ---------------------------------------------------------------------------
# primitives
# ---------------------------------------------------------------------------
def _design(X: pd.DataFrame) -> np.ndarray:
    """Centered ranks; missing → neutral 0 (the cross-sectional median)."""
    return np.nan_to_num(X[FEATURE_NAMES].to_numpy(dtype=float) - 0.5, nan=0.0)


def fit_logistic(A: np.ndarray, y: np.ndarray, l2: float = 1.0, iters: int = 50) -> np.ndarray:
    """Newton–Raphson (IRLS) with an L2 penalty on the slopes. Returns [bias, w...]."""
    n, k = A.shape
    Z = np.hstack([np.ones((n, 1)), A])
    w = np.zeros(k + 1)
    reg = np.full(k + 1, l2)
    reg[0] = 0.0
    for _ in range(iters):
        p = 1 / (1 + np.exp(-np.clip(Z @ w, -30, 30)))
        g = Z.T @ (p - y) + reg * w
        H = (Z * (p * (1 - p))[:, None]).T @ Z + np.diag(reg + 1e-9)
        step = np.linalg.solve(H, g)
        w -= step
        if np.max(np.abs(step)) < 1e-8:
            break
    return w


def predict_logistic(w: np.ndarray, A: np.ndarray) -> np.ndarray:
    return 1 / (1 + np.exp(-np.clip(w[0] + A @ w[1:], -30, 30)))


def platt_fit(q, y) -> np.ndarray:
    q = np.asarray(q, dtype=float)
    return fit_logistic((q - 0.5)[:, None], np.asarray(y, dtype=float), l2=1.0)


def platt_apply(w: np.ndarray, q) -> np.ndarray:
    q = np.asarray(q, dtype=float)
    return predict_logistic(w, (q - 0.5)[:, None])


def auc(score: np.ndarray, y: np.ndarray) -> float:
    """Mann–Whitney AUC (ties averaged)."""
    r = pd.Series(score).rank().to_numpy()
    n1 = y.sum()
    n0 = len(y) - n1
    if n1 == 0 or n0 == 0:
        return float("nan")
    return float((r[y == 1].sum() - n1 * (n1 + 1) / 2) / (n1 * n0))


def wilson(k: float, n: float, z: float = 1.96) -> tuple[float, float]:
    if n <= 0:
        return (float("nan"), float("nan"))
    p = min(max(k / n, 0.0), 1.0)
    den = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / den
    half = z * np.sqrt(max(p * (1 - p) / n + z * z / (4 * n * n), 0.0)) / den
    return (centre - half, centre + half)


def effective_n(n_obs: int, horizon: int) -> float:
    """Overlapping H-day labels: roughly one independent outcome per stock per H days."""
    return n_obs / max(horizon, 1)


def naive_score(X: pd.DataFrame) -> np.ndarray:
    """Equal-weight composite using the a-priori sign of each feature — the 'typical' score."""
    signs = np.array([FEATURES[f][2] for f in FEATURE_NAMES], dtype=float)
    return (_design(X) * signs).mean(axis=1)


# ---------------------------------------------------------------------------
# labels & model selection
# ---------------------------------------------------------------------------
def attach_labels(X: pd.DataFrame, aux: dict, horizon: int) -> pd.DataFrame:
    c, idx = aux["close"], aux["ihsg"]
    fwd = c.shift(-horizon) / c - 1
    excess = fwd - (idx.shift(-horizon) / idx - 1).values[:, None]
    out = X[~X["contaminated"]].copy()
    out["excess_fwd"] = excess.stack(future_stack=True).reindex(out.index)
    out = out[out["excess_fwd"].notna()]
    med = out.groupby(level="date")["excess_fwd"].transform("median")
    out["y"] = (out["excess_fwd"] > med).astype(int)
    out["beat_ihsg"] = (out["excess_fwd"] > 0).astype(int)
    return out


def select_l2(labeled: pd.DataFrame, train_dates: np.ndarray, horizon: int) -> float:
    """
    Nested choice of the penalty, using only the training window: fit on the early part,
    validate on the last 20 training dates with a purge of `horizon` dates in between,
    keep the penalty with the lowest validation Brier score.
    """
    d = labeled.index.get_level_values("date")
    inner = labeled[d.isin(train_dates[:-(20 + horizon)])]
    val = labeled[d.isin(train_dates[-20:])]
    if len(inner) < 1500 or val.empty:
        return 30.0
    yv = val["y"].to_numpy()

    def brier(l2):
        w = fit_logistic(_design(inner), inner["y"].to_numpy(), l2)
        return float(np.mean((predict_logistic(w, _design(val)) - yv) ** 2))
    return min(L2_GRID, key=brier)


# ---------------------------------------------------------------------------
# walk-forward
# ---------------------------------------------------------------------------
@dataclass
class CalibrationResult:
    horizon: int
    oos: pd.DataFrame
    platt: np.ndarray                       # [a, b] of p = σ(a + b·(rank − 0.5))
    final_w: np.ndarray                     # model trained on all resolved labels
    metrics: dict = field(default_factory=dict)
    reliability: pd.DataFrame = None
    deciles: pd.DataFrame = None
    folds: list = field(default_factory=list)
    coef: pd.DataFrame = None


def walk_forward(X: pd.DataFrame, aux: dict, horizon: int) -> CalibrationResult:
    labeled = attach_labels(X, aux, horizon)
    dates = np.array(sorted(labeled.index.get_level_values("date").unique()))
    D = labeled.index.get_level_values("date")

    preds, folds = [], []
    for t0 in range(MIN_TRAIN_DATES + horizon, len(dates), TEST_BLOCK):
        test_dates = dates[t0:t0 + TEST_BLOCK]
        train_dates = dates[:t0 - horizon]           # purge: labels resolve before test
        tr = labeled[D.isin(train_dates)]
        te = labeled[D.isin(test_dates)]
        if len(tr) < 500 or te.empty:
            continue
        l2 = select_l2(labeled, train_dates, horizon)
        w = fit_logistic(_design(tr), tr["y"].to_numpy(), l2)
        p = predict_logistic(w, _design(te))
        out = pd.DataFrame({"p_model": p, "p_naive": naive_score(te),
                            "y": te["y"].to_numpy(), "beat_ihsg": te["beat_ihsg"].to_numpy(),
                            "excess": te["excess_fwd"].to_numpy(), "fold": len(folds)},
                           index=te.index)
        preds.append(out)
        folds.append({"test_start": str(test_dates[0]), "test_end": str(test_dates[-1]),
                      "train_end": str(train_dates[-1]), "n_train": int(len(tr)),
                      "n_test": int(len(te)), "auc": auc(p, out["y"].to_numpy()), "l2": l2,
                      "ihsg_base_rate": float(out["beat_ihsg"].mean())})

    oos = pd.concat(preds).reset_index()
    y = oos["y"].to_numpy()
    # Calibrate on the within-day rank of the score, not its raw scale: robust to the final
    # model's scale differing from the fold models', and it defines "similar past cases"
    # as stocks that ranked at the same percentile on their own day.
    oos["q"] = oos.groupby("date")["p_model"].rank(pct=True)

    # Strict check: fold k calibrated with a curve fitted on folds < k only.
    oos["p_seq"] = np.nan
    for k in range(1, len(folds)):
        prev = oos[oos["fold"] < k]
        mask = oos["fold"] == k
        oos.loc[mask, "p_seq"] = platt_apply(platt_fit(prev["q"], prev["y"]), oos.loc[mask, "q"])

    platt = platt_fit(oos["q"], oos["y"])
    oos["p_cal"] = platt_apply(platt, oos["q"])

    final_l2 = select_l2(labeled, dates, horizon)
    final_w = fit_logistic(_design(labeled), labeled["y"].to_numpy(), final_l2)

    base = y.mean()
    brier_base = float(np.mean((base - y) ** 2))
    brier_cal = float(np.mean((oos["p_cal"] - y) ** 2))
    seq = oos[oos["fold"] >= 1]
    ys = seq["y"].to_numpy()
    brier_seq = float(np.mean((seq["p_seq"] - ys) ** 2))
    brier_seq_base = float(np.mean((ys.mean() - ys) ** 2))

    oos["decile"] = oos.groupby("date")["p_model"].transform(
        lambda s: pd.qcut(s.rank(method="first"), 10, labels=False) if len(s) >= 10 else np.nan)
    top = oos[oos["decile"] == 9]
    bottom = oos[oos["decile"] == 0]
    fold_aucs = [f["auc"] for f in folds]

    metrics = {
        "horizon": horizon,
        "n_obs": int(len(oos)), "n_dates": int(oos["date"].nunique()),
        "n_effective": float(effective_n(len(oos), horizon)),
        "n_symbols": int(oos["symbol"].nunique()),
        "oos_start": str(oos["date"].min()), "oos_end": str(oos["date"].max()),
        "base_rate": float(base),
        "auc_model": auc(oos["p_model"].to_numpy(), y),
        "auc_naive": auc(oos["p_naive"].to_numpy(), y),
        "brier_skill": 1 - brier_cal / brier_base,
        "brier_skill_sequential": 1 - brier_seq / brier_seq_base,
        "final_l2": final_l2,
        "ihsg_base_rate": float(oos["beat_ihsg"].mean()),
        "top_decile_hit": float(top["y"].mean()), "bottom_decile_hit": float(bottom["y"].mean()),
        "top_decile_excess": float(top["excess"].mean()),
        "bottom_decile_excess": float(bottom["excess"].mean()),
        "top_decile_beat_ihsg": float(top["beat_ihsg"].mean()),
        "bottom_decile_beat_ihsg": float(bottom["beat_ihsg"].mean()),
        "auc_by_fold_median": float(np.nanmedian(fold_aucs)),
        "auc_by_fold_min": float(np.nanmin(fold_aucs)),
        "auc_by_fold_max": float(np.nanmax(fold_aucs)),
        "folds_beating_chance": int(sum(a > 0.5 for a in fold_aucs)),
        "n_folds": len(folds),
    }

    oos["bin"] = pd.qcut(oos["q"].rank(method="first"), 10, labels=False)
    rel = oos.groupby("bin").agg(pred=("p_cal", "mean"), obs=("y", "mean"),
                                 n=("y", "size")).reset_index()
    rel["lo"], rel["hi"] = zip(*[wilson(o * n / horizon, n / horizon)
                                 for o, n in zip(rel["obs"], rel["n"])])

    dec = oos.groupby("decile").agg(hit=("y", "mean"), excess=("excess", "mean"),
                                    beat_ihsg=("beat_ihsg", "mean"),
                                    n=("y", "size"), p=("p_cal", "mean")).reset_index()
    dec["lo"], dec["hi"] = zip(*[wilson(h * n / horizon, n / horizon)
                                 for h, n in zip(dec["hit"], dec["n"])])

    coef = pd.DataFrame({"feature": FEATURE_NAMES, "weight": final_w[1:],
                         "family": [FEATURES[f][0] for f in FEATURE_NAMES]})

    return CalibrationResult(horizon=horizon, oos=oos, platt=platt, final_w=final_w,
                             metrics=metrics, reliability=rel, deciles=dec, folds=folds,
                             coef=coef)


def score_today(X: pd.DataFrame, cal: CalibrationResult) -> pd.DataFrame:
    """Score the latest date with the final model, map its daily rank through the Platt curve."""
    last = X.index.get_level_values("date").max()
    today = X.xs(last, level="date").copy()
    A = _design(today)
    p_model = predict_logistic(cal.final_w, A)
    q_today = pd.Series(p_model, index=today.index).rank(pct=True).to_numpy()
    today["q"] = q_today
    today["confidence"] = platt_apply(cal.platt, q_today)
    contrib = A * cal.final_w[1:]
    for i, f in enumerate(FEATURE_NAMES):
        today[f"c_{f}"] = contrib[:, i]

    oos, H = cal.oos, cal.horizon
    rows = []
    for q in q_today:
        band = oos[(oos["q"] >= q - 0.05) & (oos["q"] <= q + 0.05)]
        n = len(band)
        n_eff = n / H
        lo, hi = wilson(band["y"].mean() * n_eff, n_eff) if n else (np.nan, np.nan)
        rows.append((n, n_eff, lo, hi,
                     band["excess"].mean() if n else np.nan,
                     band["excess"].quantile(0.25) if n else np.nan,
                     band["excess"].quantile(0.75) if n else np.nan,
                     band["beat_ihsg"].mean() if n else np.nan))
    cols = ["analog_n", "analog_n_eff", "ci_lo", "ci_hi", "analog_excess",
            "analog_excess_p25", "analog_excess_p75", "analog_beat_ihsg"]
    for j, col in enumerate(cols):
        today[col] = [r[j] for r in rows]
    today["lift"] = today["confidence"] - cal.metrics["base_rate"]
    return today

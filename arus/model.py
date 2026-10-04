"""
Calibration engine: turn ranked features into an honest probability, per horizon.

Pipeline (run separately for each horizon, e.g. 1 and 20 trading days):
  1. Label: did the stock finish above the median liquid stock over the next H days?
     Beating IHSG was tried first and dropped: its base rate swings 44–58% between periods
     with the fate of a few index heavyweights, which no cross-sectional signal can know.
  2. Model: L2-regularised logistic regression on cross-sectional feature ranks, in one of
     two shapes — "global" (one set of weights for every stock) or "sector" (global weights
     plus a per-sector adjustment that is penalised harder, so a sector only departs from
     the market-wide pattern when its own data insists). Stocks rise for different reasons;
     the sector shape lets banks and coal miners weigh the same signal differently.
     Shape and penalty are chosen by nested validation inside each training window.
  3. Purged walk-forward: each 20-day test block is predicted by a model trained only on
     dates whose H-day labels had resolved before the block began.
  4. A Platt curve on the within-day rank of out-of-sample scores maps rank → empirical win
     probability. Isotonic regression was tried and dropped: it overfit the tails.

Pure numpy on purpose: transparent, dependency-light, deployable anywhere.
"""

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from arus.features import FEATURES, FEATURE_NAMES

TEST_BLOCK = 20
MIN_TRAIN_DATES = 40
L2_GRID = (30.0, 300.0, 1000.0)
SECTOR_PENALTY = 4.0        # sector adjustments cost 4× more than market-wide weights
SHAPES = ("global", "sector")
MACRO = tuple(f for f in FEATURE_NAMES if FEATURES[f][0] == "Makro")
FEATURE_SETS = {"all": tuple(FEATURE_NAMES), "no_macro": tuple(f for f in FEATURE_NAMES if f not in MACRO)}
HORIZONS = (1, 20)
K = len(FEATURE_NAMES)


# ---------------------------------------------------------------------------
# primitives
# ---------------------------------------------------------------------------
def _design(X: pd.DataFrame, feats=None) -> np.ndarray:
    """Centered ranks; missing → neutral 0 (the cross-sectional median)."""
    return np.nan_to_num(X[list(feats or FEATURE_NAMES)].to_numpy(dtype=float) - 0.5, nan=0.0)


def design(X: pd.DataFrame, shape: str, gidx: np.ndarray | None, G: int, feats=None) -> np.ndarray:
    A = _design(X, feats)
    if shape == "global" or gidx is None:
        return A
    return np.hstack([A] + [A * (gidx == g)[:, None] for g in range(G)])


def penalties(shape: str, G: int, l2: float, k: int = None) -> np.ndarray:
    k = k or K
    if shape == "global":
        return np.full(k, l2)
    return np.r_[np.full(k, l2), np.full(k * G, l2 * SECTOR_PENALTY)]


def fit_logistic(A: np.ndarray, y: np.ndarray, l2, iters: int = 50) -> np.ndarray:
    """Newton–Raphson (IRLS) with an L2 penalty on the slopes (scalar or per-column). Returns [bias, w...]."""
    n, k = A.shape
    Z = np.hstack([np.ones((n, 1)), A])
    w = np.zeros(k + 1)
    reg = np.r_[0.0, np.broadcast_to(np.asarray(l2, dtype=float), (k,))]
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
    """Monotone by construction: a negative slope would turn the ranking upside down, so when the
    out-of-sample evidence points that way the curve collapses to the flat base rate instead."""
    q = np.asarray(q, dtype=float)
    y = np.asarray(y, dtype=float)
    w = fit_logistic((q - 0.5)[:, None], y, l2=1.0)
    if w[1] < 0:
        p = min(max(y.mean(), 1e-6), 1 - 1e-6)
        w = np.array([np.log(p / (1 - p)), 0.0])
    return w


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


def effective_weights(w: np.ndarray, shape: str, g: int | None, feats=None) -> np.ndarray:
    """
    Per-feature weights a stock in group g actually uses (global + its sector adjustment),
    expanded to the full feature list with zeros for features the chosen set left out.
    """
    feats = list(feats or FEATURE_NAMES)
    k = len(feats)
    eff = w[1:1 + k].copy()
    if shape != "global" and g is not None:
        eff = eff + w[1 + k + g * k:1 + k + (g + 1) * k]
    full = dict(zip(feats, eff))
    return np.array([full.get(f, 0.0) for f in FEATURE_NAMES])


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


def group_index(df: pd.DataFrame, groups: list[str], group_of: pd.Series) -> np.ndarray:
    g = df.index.get_level_values("symbol").map(group_of).fillna("Lainnya")
    lookup = {name: i for i, name in enumerate(groups)}
    return np.array([lookup.get(x, lookup.get("Lainnya", 0)) for x in g])


def select_config(labeled: pd.DataFrame, train_dates: np.ndarray, horizon: int, gidx_all: np.ndarray, G: int) -> tuple[str, float, str]:
    """
    Nested choice of model shape and penalty using only the training window: fit on the
    early part, validate on the last 20 training dates (purged by `horizon`), keep the
    configuration with the lowest validation Brier score.
    """
    d = labeled.index.get_level_values("date")
    m_in = d.isin(train_dates[:-(20 + horizon)])
    m_va = d.isin(train_dates[-20:])
    if m_in.sum() < 1500 or m_va.sum() == 0:
        return ("global", 300.0, "no_macro")
    inner, val = labeled[m_in], labeled[m_va]
    g_in, g_va = gidx_all[m_in], gidx_all[m_va]
    yv = val["y"].to_numpy()
    best, best_b = ("global", 300.0, "no_macro"), np.inf
    for fs, feats in FEATURE_SETS.items():
        for shape in SHAPES:
            A_in, A_va = design(inner, shape, g_in, G, feats), design(val, shape, g_va, G, feats)
            for l2 in L2_GRID:
                w = fit_logistic(A_in, inner["y"].to_numpy(), penalties(shape, G, l2, len(feats)))
                b = float(np.mean((predict_logistic(w, A_va) - yv) ** 2))
                if b < best_b:
                    best, best_b = (shape, l2, fs), b
    return best


# ---------------------------------------------------------------------------
# walk-forward
# ---------------------------------------------------------------------------
@dataclass
class CalibrationResult:
    horizon: int
    oos: pd.DataFrame
    platt: np.ndarray
    final_w: np.ndarray
    shape: str
    feats: tuple
    groups: list
    group_of: pd.Series
    metrics: dict = field(default_factory=dict)
    reliability: pd.DataFrame = None
    deciles: pd.DataFrame = None
    folds: list = field(default_factory=list)
    coef: pd.DataFrame = None
    group_weights: dict = field(default_factory=dict)


def walk_forward(X: pd.DataFrame, aux: dict, horizon: int) -> CalibrationResult:
    labeled = attach_labels(X, aux, horizon)
    group_of = aux["group"]
    groups = sorted(group_of.unique())
    G = len(groups)
    gidx_all = group_index(labeled, groups, group_of)
    dates = np.array(sorted(labeled.index.get_level_values("date").unique()))
    D = labeled.index.get_level_values("date")

    preds, folds = [], []
    for t0 in range(MIN_TRAIN_DATES + horizon, len(dates), TEST_BLOCK):
        test_dates = dates[t0:t0 + TEST_BLOCK]
        train_dates = dates[:t0 - horizon]           # purge: labels resolve before test
        m_tr, m_te = D.isin(train_dates), D.isin(test_dates)
        if m_tr.sum() < 500 or m_te.sum() == 0:
            continue
        tr, te = labeled[m_tr], labeled[m_te]
        shape, l2, fs = select_config(labeled, train_dates, horizon, gidx_all, G)
        feats = FEATURE_SETS[fs]
        w = fit_logistic(design(tr, shape, gidx_all[m_tr], G, feats), tr["y"].to_numpy(), penalties(shape, G, l2, len(feats)))
        p = predict_logistic(w, design(te, shape, gidx_all[m_te], G, feats))
        out = pd.DataFrame({"p_model": p, "p_naive": naive_score(te),
                            "y": te["y"].to_numpy(), "beat_ihsg": te["beat_ihsg"].to_numpy(),
                            "excess": te["excess_fwd"].to_numpy(), "fold": len(folds)},
                           index=te.index)
        preds.append(out)
        folds.append({"test_start": str(test_dates[0]), "test_end": str(test_dates[-1]),
                      "train_end": str(train_dates[-1]), "n_train": int(len(tr)),
                      "n_test": int(len(te)), "auc": auc(p, out["y"].to_numpy()), "l2": l2,
                      "shape": shape, "features": fs, "ihsg_base_rate": float(out["beat_ihsg"].mean())})

    oos = pd.concat(preds).reset_index()
    y = oos["y"].to_numpy()
    oos["q"] = oos.groupby("date")["p_model"].rank(pct=True)

    oos["p_seq"] = np.nan
    for k in range(1, len(folds)):
        prev = oos[oos["fold"] < k]
        mask = oos["fold"] == k
        oos.loc[mask, "p_seq"] = platt_apply(platt_fit(prev["q"], prev["y"]), oos.loc[mask, "q"])

    platt = platt_fit(oos["q"], oos["y"])
    oos["p_cal"] = platt_apply(platt, oos["q"])

    shape, final_l2, final_fs = select_config(labeled, dates, horizon, gidx_all, G)
    final_feats = FEATURE_SETS[final_fs]
    final_w = fit_logistic(design(labeled, shape, gidx_all, G, final_feats), labeled["y"].to_numpy(),
                           penalties(shape, G, final_l2, len(final_feats)))

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
        "final_l2": final_l2, "final_shape": shape, "final_features": final_fs,
        "folds_sector_shape": int(sum(f["shape"] == "sector" for f in folds)),
        "folds_with_macro": int(sum(f["features"] == "all" for f in folds)),
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
    # The score is only presented as evidence when all three hold out of sample; otherwise the
    # site labels this horizon "not proven" rather than dressing up a coin flip.
    metrics["proven"] = bool(metrics["auc_model"] > 0.5
                             and 2 * metrics["folds_beating_chance"] > metrics["n_folds"]
                             and metrics["top_decile_hit"] > metrics["bottom_decile_hit"])

    oos["bin"] = pd.qcut(oos["q"].rank(method="first"), 10, labels=False)
    rel = oos.groupby("bin").agg(pred=("p_cal", "mean"), obs=("y", "mean"), n=("y", "size")).reset_index()
    rel["lo"], rel["hi"] = zip(*[wilson(o * n / horizon, n / horizon) for o, n in zip(rel["obs"], rel["n"])])

    dec = oos.groupby("decile").agg(hit=("y", "mean"), excess=("excess", "mean"),
                                    beat_ihsg=("beat_ihsg", "mean"),
                                    n=("y", "size"), p=("p_cal", "mean")).reset_index()
    dec["lo"], dec["hi"] = zip(*[wilson(h * n / horizon, n / horizon) for h, n in zip(dec["hit"], dec["n"])])

    coef = pd.DataFrame({"feature": FEATURE_NAMES, "weight": effective_weights(final_w, "global", None, final_feats),
                         "family": [FEATURES[f][0] for f in FEATURE_NAMES]})
    group_weights = {g: dict(zip(FEATURE_NAMES, effective_weights(final_w, shape, i, final_feats).round(5).tolist()))
                     for i, g in enumerate(groups)}

    return CalibrationResult(horizon=horizon, oos=oos, platt=platt, final_w=final_w, shape=shape, feats=final_feats,
                             groups=groups, group_of=group_of, metrics=metrics, reliability=rel,
                             deciles=dec, folds=folds, coef=coef, group_weights=group_weights)


def score_today(X: pd.DataFrame, cal: CalibrationResult) -> pd.DataFrame:
    """Score the latest date with the final model, map its daily rank through the Platt curve."""
    last = X.index.get_level_values("date").max()
    today = X.xs(last, level="date").copy()
    G = len(cal.groups)
    lookup = {name: i for i, name in enumerate(cal.groups)}
    gidx = np.array([lookup.get(cal.group_of.get(s, "Lainnya"), lookup.get("Lainnya", 0)) for s in today.index])
    A = _design(today)
    p_model = predict_logistic(cal.final_w, design(today, cal.shape, gidx, G, cal.feats))
    q_today = pd.Series(p_model, index=today.index).rank(pct=True).to_numpy()
    today["q"] = q_today
    today["confidence"] = platt_apply(cal.platt, q_today)
    W = np.vstack([effective_weights(cal.final_w, cal.shape, g, cal.feats) for g in gidx])
    contrib = A * W
    for i, f in enumerate(FEATURE_NAMES):
        today[f"c_{f}"] = contrib[:, i]
    today["group"] = [cal.groups[g] for g in gidx]

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


def score_dates(X: pd.DataFrame, cal: CalibrationResult, after: str) -> pd.DataFrame:
    """Daily ranks from the final model for dates after the last resolved label (no outcome yet)."""
    D = X.index.get_level_values("date")
    sub = X[D > after]
    if sub.empty:
        return pd.DataFrame(columns=["date", "symbol", "q"])
    G = len(cal.groups)
    lookup = {name: i for i, name in enumerate(cal.groups)}
    gidx = np.array([lookup.get(cal.group_of.get(sym, "Lainnya"), lookup.get("Lainnya", 0))
                     for sym in sub.index.get_level_values("symbol")])
    p = predict_logistic(cal.final_w, design(sub, cal.shape, gidx, G, cal.feats))
    out = pd.DataFrame({"p": p}, index=sub.index).reset_index()
    out["q"] = out.groupby("date")["p"].rank(pct=True)
    return out[["date", "symbol", "q"]]

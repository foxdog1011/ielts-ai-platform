import numpy as np

def quadratic_weighted_kappa(y_true, y_pred, min_rating=None, max_rating=None):
    """
    Quadratic Weighted Kappa (QWK).
    y_true, y_pred: 1D arrays of INTEGER ratings (e.g., 0,1,2,...)
    """
    y_true = np.asarray(y_true, dtype=int)
    y_pred = np.asarray(y_pred, dtype=int)

    if min_rating is None:
        min_rating = int(min(y_true.min(), y_pred.min()))
    if max_rating is None:
        max_rating = int(max(y_true.max(), y_pred.max()))

    n = max_rating - min_rating + 1
    # Observed matrix
    O = np.zeros((n, n), dtype=float)
    for a, b in zip(y_true, y_pred):
        O[a - min_rating, b - min_rating] += 1.0

    # Expected matrix
    act_hist = O.sum(axis=1)
    pred_hist = O.sum(axis=0)
    E = np.outer(act_hist, pred_hist) / max(1.0, O.sum())

    # Quadratic weights
    if n > 1:
        W = np.fromfunction(lambda i, j: ((i - j) ** 2) / ((n - 1) ** 2), (n, n))
    else:
        W = np.zeros((1, 1), dtype=float)

    num = (W * O).sum()
    den = (W * E).sum()
    return 1.0 - num / den if den > 0 else 0.0

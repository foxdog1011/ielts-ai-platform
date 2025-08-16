# src/calibrate_band.py
from __future__ import annotations
import argparse, json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression

def to_half_band(x: np.ndarray) -> np.ndarray:
    return np.round(x * 2) / 2

def linear_map(overall: np.ndarray, low_high=(4.0, 9.0)) -> np.ndarray:
    y = low_high[0] + (low_high[1] - low_high[0]) * np.clip(overall, 0, 1)
    return to_half_band(y)

def parse_quantile_spec(spec: str) -> list[tuple[float, float]]:
    """
    解析像 '4.0:0.05,4.5:0.10,5.0:0.20,...,9.0:1.00'
    回傳 [(band, percentile), ...]，percentile 為 0..1
    """
    pairs = []
    for seg in spec.split(","):
        seg = seg.strip()
        if not seg: continue
        b, p = seg.split(":")
        pairs.append((float(b), float(p)))
    pairs.sort(key=lambda x: x[1])
    return pairs

def quantile_map(overall: np.ndarray, spec_pairs: list[tuple[float, float]]) -> tuple[np.ndarray, dict]:
    """
    將 overall_01 依 quantile 斷點離散成 band（0.5 間距）。
    spec_pairs：[(band, percentile), ...]；最後一個 percentile 應為 1.0，band 通常為 9.0
    作法：計算每個 percentile 的 score 斷點 q_i；overall <= q_i → 該 band。
    """
    xs = np.clip(overall.astype(float), 0, 1)
    ps = [p for _, p in spec_pairs]
    bs = [b for b, _ in spec_pairs]
    qs = np.quantile(xs, ps, method="linear")

    # 對每一個樣本找第一個 >= 的 quantile 位置
    band = np.empty_like(xs)
    for i, v in enumerate(xs):
        idx = int(np.searchsorted(qs, v, side="right"))
        idx = min(idx, len(bs)-1)
        band[i] = bs[idx]
    return to_half_band(band), {"bands": bs, "percentiles": ps, "quantiles": qs.tolist()}

def fit_isotonic(overall: np.ndarray, band_true: np.ndarray):
    lo = 4.0 if np.nanmin(band_true) >= 4.0 else 0.0
    y = (np.clip(band_true, lo, 9.0) - lo) / (9.0 - lo)
    iso = IsotonicRegression(y_min=0.0, y_max=1.0, increasing=True, out_of_bounds="clip")
    iso.fit(overall, y)
    return iso, lo

def export_curve_json(xs: np.ndarray, bands: np.ndarray, out_json: Path, mode: str, extra: dict):
    obj = {"overall01": xs.tolist(), "band": to_half_band(bands).tolist(), "mode": mode, **extra}
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scores", required=True, help="輸入 CSV（至少含 overall_01）")
    ap.add_argument("--out", required=True, help="輸出 CSV（多一欄 band_calibrated）")
    ap.add_argument("--mode", choices=["linear","quantile","isotonic"], default="linear")
    ap.add_argument("--low", type=float, default=4.0, help="linear 模式最低 band")
    ap.add_argument("--high", type=float, default=9.0, help="linear 模式最高 band")
    ap.add_argument("--quantile-spec", type=str,
                    default="4.0:0.05,4.5:0.10,5.0:0.20,5.5:0.35,6.0:0.55,6.5:0.70,7.0:0.85,7.5:0.93,8.0:0.97,8.5:0.99,9.0:1.00",
                    help="quantile 模式的 band:percentile 斷點（0..1）")
    ap.add_argument("--labels", default="", help="isotonic 模式：CSV，含 overall_01,band_true")
    args = ap.parse_args()

    df = pd.read_csv(args.scores)
    if "overall_01" not in df.columns:
        raise SystemExit("scores 缺少 overall_01 欄位")

    out_path = Path(args.out)
    cal_dir = Path("artifacts") / "calibration"
    cal_dir.mkdir(parents=True, exist_ok=True)

    if args.mode == "linear":
        df["band_calibrated"] = linear_map(df["overall_01"].values, (args.low, args.high))
        df.to_csv(out_path, index=False)
        # 匯出曲線（均勻取 0..1）
        grid = np.linspace(0,1,201)
        export_curve_json(grid, linear_map(grid, (args.low,args.high)), cal_dir/"linear_curve.json", "linear", {"low":args.low,"high":args.high})
        print(f"[OK] linear[{args.low},{args.high}] -> {out_path} ({len(df)} rows)")

    elif args.mode == "quantile":
        pairs = parse_quantile_spec(args.quantile_spec)
        bands, meta = quantile_map(df["overall_01"].values, pairs)
        df["band_calibrated"] = bands
        df.to_csv(out_path, index=False)
        # 匯出離散映射（含實際量化點）
        grid = np.linspace(0,1,201)
        grid_bands, meta_grid = quantile_map(grid, pairs)
        export_curve_json(grid, grid_bands, cal_dir/"quantile_map.json", "quantile", {"spec":pairs, "fit":meta})
        print(f"[OK] quantile -> {out_path} ({len(df)} rows) | filled={int(np.isfinite(bands).sum())}")

    else:  # isotonic
        if not args.labels:
            raise SystemExit("isotonic 模式需要 --labels（含 overall_01, band_true）")
        lab = pd.read_csv(args.labels)
        if not {"overall_01","band_true"}.issubset(lab.columns):
            raise SystemExit("labels 需含 overall_01, band_true")
        iso, lo = fit_isotonic(lab["overall_01"].values, lab["band_true"].values)
        yhat = iso.predict(df["overall_01"].values)
        band = lo + (9.0 - lo) * np.clip(yhat, 0, 1)
        df["band_calibrated"] = to_half_band(band)
        df.to_csv(out_path, index=False)
        xs = np.linspace(0,1,201)
        export_curve_json(xs, lo + (9.0-lo)*iso.predict(xs), cal_dir/"isotonic_curve.json", "isotonic", {"lo":lo})
        print(f"[OK] isotonic(lo={lo}) -> {out_path} ({len(df)} rows)")

if __name__ == "__main__":
    main()

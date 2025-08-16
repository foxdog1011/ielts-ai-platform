# tools/quick_report.py
from __future__ import annotations
from pathlib import Path
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

def pct(x, p): return float(np.nanpercentile(x, p))

def describe_scores(csv_path: str, out_dir: str = "tmp/report"):
    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(csv_path)

    cols = ["content_01","fluency_01","pronunciation_01","overall_01"]
    stats = {}
    for c in cols:
        if c in df.columns:
            x = df[c].astype(float)
            stats[c] = {
                "count": int(x.notna().sum()),
                "mean": float(np.nanmean(x)),
                "std": float(np.nanstd(x)),
                "p10": pct(x,10), "p25": pct(x,25), "p50": pct(x,50),
                "p75": pct(x,75), "p90": pct(x,90),
            }

    # 儲存文字報表
    rep = Path(out/"summary.txt")
    rep.write_text(pd.DataFrame(stats).T.to_string(float_format=lambda v:f"{v:.3f}"), encoding="utf-8")

    # 直方圖
    for c in cols:
        if c in df.columns:
            plt.figure()
            df[c].dropna().hist(bins=30)
            plt.title(c)
            plt.xlabel("score (0..1)"); plt.ylabel("count")
            plt.tight_layout()
            plt.savefig(out/f"hist_{c}.png", dpi=140)
            plt.close()

    # 關聯：fluency vs pronunciation
    if set(["fluency_01","pronunciation_01"]).issubset(df.columns):
        plt.figure()
        sub = df[["fluency_01","pronunciation_01"]].dropna()
        plt.scatter(sub["fluency_01"], sub["pronunciation_01"], s=6, alpha=0.3)
        plt.xlabel("fluency_01"); plt.ylabel("pronunciation_01")
        plt.title("Fluency vs Pronunciation")
        plt.tight_layout()
        plt.savefig(out/"scatter_flu_pron.png", dpi=140)
        plt.close()

    # 語速（有 transcript 時）：
    if "wpm" in df.columns:
        plt.figure()
        df["wpm"].replace([np.inf,-np.inf], np.nan, inplace=True)
        df["wpm"].dropna().clip(0, 300).hist(bins=40)  # clip 避免極端值
        plt.title("wpm"); plt.xlabel("words per minute"); plt.ylabel("count")
        plt.tight_layout()
        plt.savefig(out/"hist_wpm.png", dpi=140); plt.close()

    print(f"[OK] summary -> {rep}")
    print(f"[OK] charts -> {out}/hist_*.png, scatter_flu_pron.png, hist_wpm.png")

if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True, help="e.g., tmp/speaking_scores_all.csv")
    ap.add_argument("--out", default="tmp/report")
    args = ap.parse_args()
    describe_scores(args.csv, args.out)

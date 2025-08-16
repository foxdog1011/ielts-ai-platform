# tools/peek_table.py
from __future__ import annotations
import pandas as pd
from pathlib import Path

def main(csv_path: str, n: int = 20, out: str = "tmp/peek.csv"):
    df = pd.read_csv(csv_path)
    cols = ["audio_path","word_count","wpm","content_01","fluency_01","pronunciation_01","overall_01","band_estimate"]
    cols = [c for c in cols if c in df.columns]
    small = df[cols].head(n)
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    small.to_csv(out, index=False)
    print(f"[OK] wrote {out}")

if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True)
    ap.add_argument("--n", type=int, default=20)
    ap.add_argument("--out", default="tmp/peek.csv")
    args = ap.parse_args()
    main(args.csv, args.n, args.out)

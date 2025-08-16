import argparse
import csv
import glob
import os
import sys
import zipfile
from pathlib import Path

import pandas as pd

DATA_DIR = Path("data")
RAW_DIR = DATA_DIR / "raw"
OUT_TRAIN = DATA_DIR / "asap_train.csv"
OUT_VALID = DATA_DIR / "asap_valid.csv"


def _ensure_asap_file() -> Path | None:
    """
    在 data/raw/** 底下尋找：
    - training_set_rel3.tsv / .csv
    - 或包含該檔案的 .zip（會自動解壓到 data/raw/asap/）
    皆找不到時回傳 None
    """
    # 1) 直接找 tsv/csv
    for ext in ("*.tsv", "*.csv"):
        hits = glob.glob(str(RAW_DIR / "**" / ext), recursive=True)
        hits = [h for h in hits if "training_set_rel3" in os.path.basename(h).lower()]
        if hits:
            hits.sort(key=lambda p: len(p))
            return Path(hits[0])

    # 2) 找 zip 並嘗試解壓出 training_set_rel3.*
    zips = glob.glob(str(RAW_DIR / "**" / "*.zip"), recursive=True)
    for z in sorted(zips, key=lambda p: len(p)):
        try:
            with zipfile.ZipFile(z) as zf:
                names = zf.namelist()
                cand = None
                for n in names:
                    ln = n.lower()
                    if "training_set_rel3" in ln and (ln.endswith(".tsv") or ln.endswith(".csv")):
                        cand = n
                        break
                if cand:
                    out_dir = RAW_DIR / "asap"
                    out_dir.mkdir(parents=True, exist_ok=True)
                    out_path = out_dir / os.path.basename(cand)
                    with zf.open(cand) as src, open(out_path, "wb") as dst:
                        dst.write(src.read())
                    print(f"[INFO] 從 zip 解壓：{z} -> {out_path}")
                    return out_path
        except zipfile.BadZipFile:
            continue
    return None


def _read_any(path: Path) -> pd.DataFrame:
    """
    嘗試用多組設定讀取（ASAP 原檔常見非 UTF-8、引號不規則）
    """
    trials = [
        dict(sep="\t", engine="python", encoding="utf-8"),
        dict(sep="\t", engine="python", encoding="utf-8", quoting=csv.QUOTE_NONE, on_bad_lines="skip"),
        dict(sep="\t", engine="python", encoding="latin1"),
        dict(sep="\t", engine="python", encoding="latin1", quoting=csv.QUOTE_NONE, on_bad_lines="skip"),
    ]
    last_err = None
    for kw in trials:
        try:
            return pd.read_csv(path, **kw)
        except Exception as e:
            last_err = e
    raise RuntimeError(f"讀取 {path} 失敗。最後錯誤：{last_err}")


def _add_norm_labels(df: pd.DataFrame) -> pd.DataFrame:
    """
    需要欄位：essay, domain1_score, essay_set
    產出：score_norm01（依各 essay_set 的 min-max 映射到 [0,1]）
    """
    required = {"essay", "domain1_score", "essay_set"}
    if not required.issubset(set(df.columns)):
        raise ValueError(f"ASAP 欄位缺少 {required}，目前欄位：{list(df.columns)[:20]}")

    df = df.copy()
    df["essay"] = df["essay"].astype(str).str.replace(r"\s+", " ", regex=True).str.strip()
    df["domain1_score"] = df["domain1_score"].astype(int)

    stats = (
        df.groupby("essay_set")["domain1_score"]
        .agg(["min", "max"])
        .reset_index()
        .rename(columns={"min": "score_min", "max": "score_max"})
    )
    df = df.merge(stats, on="essay_set", how="left")
    rng = (df["score_max"] - df["score_min"]).replace(0, 1)
    df["score_norm01"] = (df["domain1_score"] - df["score_min"]) / rng
    return df


def prepare_asap():
    asap = _ensure_asap_file()
    if not asap or not Path(asap).exists():
        print(
            "[ERROR] 找不到 ASAP。請把 'training_set_rel3.tsv'（或 zip/csv）放到 data/raw/asap/ 或 data/raw/ 下任何子資料夾。",
            file=sys.stderr,
        )
        sys.exit(1)
    print(f"[INFO] 使用檔案：{asap}")

    df = _read_any(asap)
    df = _add_norm_labels(df)

    # 依 essay_set 分層切分（80/20）
    train_parts, valid_parts = [], []
    for s, g in df.groupby("essay_set", sort=True):
        n = len(g)
        cut = max(1, int(n * 0.8))
        train_parts.append(g.iloc[:cut].copy())
        valid_parts.append(g.iloc[cut:].copy())

    train_df = pd.concat(train_parts, axis=0).sample(frac=1, random_state=42).reset_index(drop=True)
    valid_df = pd.concat(valid_parts, axis=0).sample(frac=1, random_state=42).reset_index(drop=True)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    train_df.to_csv(OUT_TRAIN, index=False)
    valid_df.to_csv(OUT_VALID, index=False)

    print(f"[OK] 訓練集：{OUT_TRAIN}（{len(train_df)}）")
    print(f"[OK] 驗證集：{OUT_VALID}（{len(valid_df)}）")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--task", default="prepare_asap")
    args = ap.parse_args()
    if args.task == "prepare_asap":
        prepare_asap()
    else:
        print(f"[ERROR] 未支援任務：{args.task}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()

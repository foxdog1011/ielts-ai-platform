# src/batch_score.py
from __future__ import annotations
import argparse, math
from pathlib import Path
import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer
from xgboost import XGBRegressor
from speech_features import extract_features

ART_DIR = Path("artifacts") / "writing_baseline"
EMB_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

def _simple_text_feats(text: str):
    import re
    words = text.split()
    n_words = len(words)
    n_chars = len(text)
    avg_wlen = (sum(len(w) for w in words) / max(1, n_words))
    uniq_ratio = len(set(w.lower() for w in words)) / max(1, n_words)
    sents = re.split(r"[.!?]+", text)
    sents = [s.strip() for s in sents if s.strip()]
    n_sents = max(1, len(sents))
    avg_sent_len = n_words / n_sents
    return np.array([n_words, n_chars, avg_wlen, uniq_ratio, n_sents, avg_sent_len], dtype=float)

def _to_band_0_9(overall_01: float) -> float:
    band = 4.0 + 5.0 * float(np.clip(overall_01, 0, 1))
    return float(np.round(band * 2) / 2)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True, help="CSV: audio_path,transcript")
    ap.add_argument("--out", required=True, help="輸出 CSV")
    ap.add_argument("--limit", type=int, default=0, help="只跑前 N 筆（0 = 全部）")
    args = ap.parse_args()

    man = pd.read_csv(args.manifest)
    if args.limit > 0:
        man = man.head(args.limit)

    wm = XGBRegressor()
    wm.load_model(str(ART_DIR / "xgb.json"))
    embedder = SentenceTransformer(EMB_MODEL)

    rows = []
    for _, row in man.iterrows():
        audio = str(row["audio_path"])
        tx = row.get("transcript", "")
        text = "" if (isinstance(tx, float) and math.isnan(tx)) else str(tx)

        # content
        if text:
            try:
                E = embedder.encode([text], batch_size=64, show_progress_bar=False, convert_to_numpy=True)
                F = _simple_text_feats(text).reshape(1, -1)
                X = np.hstack([E, F])
                content = float(np.clip(wm.predict(X)[0], 0, 1))
            except Exception as e:
                print(f"[WARN] content embed/predict 失敗: {audio}: {e}")
                content = np.nan
        else:
            content = np.nan

        # speaking
        try:
            spk_feats, spk_scores, spk_unc = extract_features(audio, transcript=text)
            fluency = spk_scores["fluency_score"]
            pron = spk_scores["pronunciation_score"]
            flu_std = spk_unc["fluency_std"]
            pron_std = spk_unc["pronunciation_std"]
        except Exception as e:
            print(f"[WARN] 語音特徵失敗: {audio}: {e}")
            spk_feats = {
                "duration_s": np.nan, "voiced_duration_s": np.nan, "silent_duration_s": np.nan,
                "pause_count_ge300ms": np.nan, "avg_pause_s": np.nan, "pause_ratio": np.nan,
                "wpm": np.nan, "articulation_wpm": np.nan, "f0_std_hz": np.nan, "energy_std": np.nan,
                "word_count": len(text.split()) if text else 0,
                "filler_count": 0, "self_repair_count": 0, "filler_per_100w": 0.0, "self_repair_per_100w": 0.0
            }
            fluency = np.nan; pron = np.nan; flu_std = 0.0; pron_std = 0.0

        # 融合（和你先前一樣的權重）
        parts = []
        w_content = 0.35 if not (isinstance(content,float) and np.isnan(content)) else 0.0
        w_flu = 0.35
        w_pron = 0.30
        if w_content: parts.append((content, w_content))
        if not (isinstance(fluency,float) and np.isnan(fluency)): parts.append((fluency, w_flu))
        if not (isinstance(pron,float) and np.isnan(pron)): parts.append((pron, w_pron))

        if parts:
            w_sum = sum(w for _, w in parts)
            overall = sum(v * (w / w_sum) for v, w in parts)
            # 簡單不確定度：成分的 std 以相同比重合成
            overall_std = float(np.sqrt(( (flu_std*w_flu)**2 + (pron_std*w_pron)**2 )) / max(1e-6, w_sum))
            band = _to_band_0_9(overall)
        else:
            overall = np.nan; overall_std = 0.0; band = np.nan

        rows.append({
            "audio_path": audio,
            "transcript": text,
            "content_01": content,
            "fluency_01": fluency,
            "pronunciation_01": pron,
            "overall_01": overall,
            "overall_std": overall_std,
            "band_estimate": band,
            **spk_feats,
            "fluency_std": flu_std,
            "pronunciation_std": pron_std
        })

    out_df = pd.DataFrame(rows)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    out_df.to_csv(args.out, index=False)
    print(f"[OK] wrote {args.out} ({len(out_df)} rows)")

if __name__ == "__main__":
    main()

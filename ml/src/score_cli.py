from __future__ import annotations
import argparse, json, sys
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import numpy as np
from sentence_transformers import SentenceTransformer
from xgboost import XGBRegressor
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

# 你專案內的語音特徵
from speech_features import extract_features  # 保留原 import；下方會做兼容包裝

ART_DIR = Path("artifacts") / "writing_baseline"
EMB_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

# -----------------------------
# Utilities
# -----------------------------
def _simple_text_feats(text: str) -> np.ndarray:
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
    stop_cnt = sum(1 for w in words if w.lower() in ENGLISH_STOP_WORDS)
    stop_ratio = stop_cnt / max(1, n_words)
    return np.array(
        [n_words, n_chars, avg_wlen, uniq_ratio, n_sents, avg_sent_len, stop_ratio],
        dtype=float,
    )

def _embed_texts(texts):
    model = SentenceTransformer(EMB_MODEL)
    return model.encode(texts, batch_size=64, show_progress_bar=False, convert_to_numpy=True)

def _load_writing_model() -> XGBRegressor:
    path = ART_DIR / "xgb.json"
    if not path.exists():
        raise FileNotFoundError(f"找不到 {path}，請先執行 make train_writing")
    m = XGBRegressor()
    m.load_model(str(path))
    return m

def _predict_content_norm(text: str, model: XGBRegressor) -> float:
    E = _embed_texts([text])
    F = _simple_text_feats(text)[:6]  # 與訓練特徵一致（前 6 個）
    X = np.hstack([E, F.reshape(1, -1)])
    y = float(model.predict(X)[0])
    if not np.isfinite(y):
        y = 0.0
    return float(np.clip(y, 0.0, 1.0))

def _to_band_0_9(overall_01: float) -> float:
    # 暫時線性映射：0→約4.0；1→約9.0，四捨五入到 0.5
    band = 4.0 + 5.0 * float(np.clip(overall_01, 0, 1))
    return float(np.round(band * 2) / 2)

def _nan_to_none(x: Optional[float]) -> Optional[float]:
    if x is None:
        return None
    try:
        return None if (not np.isfinite(x)) else float(x)
    except Exception:
        return None

# -----------------------------
# 寬鬆包裝：extract_features 可能回傳 1 / 2 / 3 個元素、或不同鍵名
# 一律正規化為 (features_dict, {"fluency_01":..., "pronunciation_01":...})
# -----------------------------
def _safe_extract_speaking(audio_path: str, transcript: Optional[str] = None
                           ) -> Tuple[Dict[str, Any], Dict[str, float]]:
    """
    Wrap speech_features.extract_features to tolerate different return signatures.
    Always returns (features_dict, scores_dict) with keys 'fluency_01' and 'pronunciation_01' if available.
    """
    res = extract_features(audio_path, transcript=transcript)

    feats: Dict[str, Any] = {}
    scores_raw: Dict[str, Any] = {}

    # 兼容多種回傳型態
    if isinstance(res, tuple):
        if len(res) >= 2:
            feats, scores_raw = res[0], res[1]
        elif len(res) == 1:
            feats, scores_raw = res[0], {}
        else:
            feats, scores_raw = {}, {}
    elif isinstance(res, dict):
        # 可能是合併在一起的物件
        feats = res.get("features", res)
        scores_raw = res.get("scores", {})
    else:
        feats, scores_raw = {}, {}

    # 嘗試各種鍵名 → 正規化成 *_01
    def pick(d: Dict[str, Any], names) -> Optional[float]:
        for n in names:
            if n in d and d[n] is not None:
                try:
                    return float(d[n])
                except Exception:
                    pass
        return None

    flu = pick(scores_raw, ["fluency_01", "fluency_norm", "fluency_score", "fluency"])
    pro = pick(scores_raw, ["pronunciation_01", "pron_norm", "pronunciation_score", "pronunciation", "pron_score"])

    norm_scores = {
        "fluency_01": _nan_to_none(flu),
        "pronunciation_01": _nan_to_none(pro),
    }
    return feats or {}, norm_scores

# -----------------------------
# Main
# -----------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", type=str, default="", help="寫作內容或口說轉錄文本")
    ap.add_argument("--audio", type=str, default="", help="口說音檔路徑（wav/mp3/flac）")
    ap.add_argument("--transcript", type=str, default="", help="若 --text 是題目，可於此提供轉錄文本")
    ap.add_argument("--out", type=str, default="")
    args = ap.parse_args()

    text_for_content = args.text or args.transcript
    if not text_for_content and not args.audio:
        raise SystemExit("至少需要 --text 或 --audio 之一")

    # 1) content（寫作或口說的文本面）
    content_score: Optional[float] = None
    if text_for_content:
        try:
            wm = _load_writing_model()
            content_score = _predict_content_norm(text_for_content, wm)
        except Exception as e:
            # 若沒有寫作模型，就先不算 content，不致整段報錯
            # 也可改成 print 到 stderr 方便除錯
            print(f"[WARN] content 模型不可用：{e}", file=sys.stderr)
            content_score = None

    # 2) 語音（fluency / pronunciation）
    fluency_score = pronunciation_score = None
    spk_feats: Dict[str, Any] = {}
    if args.audio:
        try:
            spk_feats, spk_scores = _safe_extract_speaking(
                args.audio,
                transcript=(args.transcript or args.text) or None
            )
            fluency_score = spk_scores.get("fluency_01")
            pronunciation_score = spk_scores.get("pronunciation_01")
        except Exception as e:
            print(f"[ERROR] extract_features 失敗：{e}", file=sys.stderr)

    # 3) 融合（content: 0.35, fluency: 0.35, pronunciation: 0.30）
    parts = []
    if content_score is not None:       parts.append(("content",         content_score,        0.35))
    if fluency_score is not None:       parts.append(("fluency",         fluency_score,        0.35 if content_score is None else 0.35))
    if pronunciation_score is not None: parts.append(("pronunciation",   pronunciation_score,  0.30))
    if not parts:
        raise SystemExit("沒有可用的子分數（請提供 --text 或 --audio）")

    w_sum = sum(w for _, _, w in parts)
    overall = sum(v * (w / w_sum) for _, v, w in parts)
    if not np.isfinite(overall):
        overall = 0.0
    overall = float(np.clip(overall, 0.0, 1.0))
    band = _to_band_0_9(overall)

    result = {
        "inputs": {
            "text": (text_for_content[:60] + ("..." if text_for_content and len(text_for_content) > 60 else "")) if text_for_content else "",
            "audio": args.audio or ""
        },
        "subscores_01": {
            "content": _nan_to_none(content_score),
            "fluency": _nan_to_none(fluency_score),
            "pronunciation": _nan_to_none(pronunciation_score)
        },
        "speaking_features": spk_feats,
        "overall_01": float(overall),
        "band_estimate": band
    }

    out = json.dumps(result, ensure_ascii=False, indent=2)
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(out, encoding="utf-8")
    print(out)

if __name__ == "__main__":
    main()

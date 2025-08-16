# src/speech_features.py
from __future__ import annotations
import re
from typing import Dict, Tuple, Optional
import numpy as np
import librosa

def _clip01(x, lo, hi):
    if lo == hi: return 0.0
    return float(np.clip((x - lo) / (hi - lo), 0.0, 1.0))

# --- (A) 文字端：filler / self-repair ---
_FILLERS = [
    r"\bum\b", r"\buh\b", r"\ber\b", r"\bah\b", r"\bhmm\b",
    r"\byou know\b", r"\bkinda\b", r"\bkind of\b", r"\bsorta\b",
    r"\blik[e]?\b", r"\bi mean\b", r"\bwell\b"
]
_FILLER_RE = re.compile("|".join(_FILLERS), flags=re.I)

def _disfluency_stats(transcript: Optional[str]) -> Dict[str, float]:
    if not transcript:
        return {"filler_count": 0, "self_repair_count": 0, "words": 0,
                "filler_per_100w": 0.0, "self_repair_per_100w": 0.0}
    t = transcript.strip()
    words = re.findall(r"[A-Za-z']+", t)
    n_words = len(words)

    # fillers
    filler_count = len(_FILLER_RE.findall(t))

    # self-repair: 重複詞、I-I / and-and；簡單偵測
    toks = [w.lower() for w in words]
    rep = sum(1 for i in range(1, len(toks)) if toks[i] == toks[i-1])
    # 編輯語：sorry / I mean / no, I mean / let me / rather / I mean
    edit_phrases = re.findall(r"\b(sorry|i mean|no[, ]+i mean|let me|i mean|actually)\b", t, flags=re.I)
    self_repair = rep + len(edit_phrases)

    per100 = lambda c: (c * 100.0 / max(1, n_words))
    return {
        "filler_count": float(filler_count),
        "self_repair_count": float(self_repair),
        "words": float(n_words),
        "filler_per_100w": per100(filler_count),
        "self_repair_per_100w": per100(self_repair),
    }

# --- (B) 語音端：核心特徵 + bootstrap 不確定度 ---
def _compute_base_features(y: np.ndarray, sr: int, transcript: Optional[str], top_db: int):
    dur = len(y) / sr if len(y) else 1e-4

    # voiced / silence
    intervals = librosa.effects.split(y, top_db=top_db, frame_length=2048, hop_length=512)
    voiced_dur, gaps, last_end = 0.0, [], 0
    for s, e in intervals:
        voiced_dur += (e - s) / sr
        if s > last_end:
            gaps.append((s - last_end) / sr)
        last_end = e
    if last_end < len(y):
        gaps.append((len(y) - last_end) / sr)

    silent_dur = max(0.0, dur - voiced_dur)
    long_gaps = [g for g in gaps if g >= 0.3]
    pause_cnt = len(long_gaps)
    avg_pause = (np.mean(long_gaps) if long_gaps else 0.0)

    # 文字統計 + disfluency
    dis = _disfluency_stats(transcript)
    n_words = int(dis["words"])
    wpm = 60.0 * n_words / dur
    art_rate = 60.0 * n_words / max(voiced_dur, 1e-6)

    # pitch / energy 穩定度
    try:
        f0 = librosa.yin(y, fmin=50, fmax=400, sr=sr, frame_length=2048, hop_length=256)
        f0 = f0[np.isfinite(f0)]
        f0_std = float(np.std(f0)) if f0.size else 0.0
    except Exception:
        f0_std = 0.0
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
    energy_std = float(np.std(rms)) if rms.size else 0.0

    pause_ratio = silent_dur / max(dur, 1e-6)

    feats = {
        "duration_s": dur, "voiced_duration_s": voiced_dur, "silent_duration_s": silent_dur,
        "pause_count_ge300ms": pause_cnt, "avg_pause_s": avg_pause, "pause_ratio": pause_ratio,
        "wpm": wpm, "articulation_wpm": art_rate, "f0_std_hz": f0_std, "energy_std": energy_std,
        "word_count": n_words,
        # disfluencies
        "filler_count": dis["filler_count"],
        "self_repair_count": dis["self_repair_count"],
        "filler_per_100w": dis["filler_per_100w"],
        "self_repair_per_100w": dis["self_repair_per_100w"],
    }
    return feats

def _scores_from_feats(feats: Dict[str, float]) -> Dict[str, float]:
    # 轉 0..1 分數
    s_art = _clip01(feats["articulation_wpm"], 90, 220)
    s_wpm = _clip01(feats["wpm"], 70, 180)
    s_pause_ratio = 1.0 - _clip01(feats["pause_ratio"], 0.05, 0.40)
    s_avg_pause = 1.0 - _clip01(feats["avg_pause_s"], 0.15, 0.80)
    s_f0_stab = 1.0 - _clip01(feats["f0_std_hz"], 20, 80)
    s_energy_stab = 1.0 - _clip01(feats["energy_std"], 0.02, 0.20)
    # 新增：filler / self-repair 罰分（每 100 words）
    s_filler = 1.0 - _clip01(feats["filler_per_100w"], 2.0, 12.0)
    s_repair = 1.0 - _clip01(feats["self_repair_per_100w"], 1.0, 6.0)

    fluency = float(np.clip(0.25*s_art + 0.20*s_wpm + 0.20*s_pause_ratio + 0.10*s_avg_pause
                            + 0.15*s_filler + 0.10*s_repair, 0, 1))
    pronunciation = float(np.clip(0.6*s_f0_stab + 0.4*s_energy_stab, 0, 1))
    return {"fluency_score": fluency, "pronunciation_score": pronunciation}

def _bootstrap_uncert(y: np.ndarray, sr: int, transcript: Optional[str], base_top_db: int,
                      n: int = 8, seed: int = 7) -> Dict[str, float]:
    """重複計算（微擾參數、子採樣）估計分數標準差。"""
    rng = np.random.default_rng(seed)
    flu, pro = [], []
    for _ in range(n):
        # 1) top_db 亂數微擾  ±5dB；2) 隨機丟棄 2% 取樣點（模擬噪音漏檢）
        top_db = int(np.clip(base_top_db + rng.normal(0, 5), 25, 60))
        mask = np.ones_like(y, dtype=bool)
        drop = rng.choice(len(y), size=int(0.02*len(y)), replace=False)
        mask[drop] = False
        y2 = y[mask] if y.size > 0 else y

        feats = _compute_base_features(y2, sr, transcript, top_db)
        sc = _scores_from_feats(feats)
        flu.append(sc["fluency_score"])
        pro.append(sc["pronunciation_score"])
    return {
        "fluency_std": float(np.std(flu)) if flu else 0.0,
        "pronunciation_std": float(np.std(pro)) if pro else 0.0
    }

def extract_features(audio_path: str, transcript: str | None = None,
                     sr: int = 16000, top_db: int = 35) -> Tuple[Dict[str, float], Dict[str, float], Dict[str, float]]:
    """
    回傳 (features_dict, scores_dict, uncertainty_dict)
    讀不到音檔 → 回 NaN 特徵 + NaN 分數 + 0 不確定度（讓上游不中斷）
    """
    try:
        y, sr = librosa.load(audio_path, sr=sr, mono=True)
    except Exception:
        feats = {
            "duration_s": np.nan, "voiced_duration_s": np.nan, "silent_duration_s": np.nan,
            "pause_count_ge300ms": np.nan, "avg_pause_s": np.nan, "pause_ratio": np.nan,
            "wpm": np.nan, "articulation_wpm": np.nan, "f0_std_hz": np.nan, "energy_std": np.nan,
            "word_count": len(transcript.split()) if transcript else 0,
            "filler_count": 0, "self_repair_count": 0,
            "filler_per_100w": 0.0, "self_repair_per_100w": 0.0,
        }
        return feats, {"fluency_score": np.nan, "pronunciation_score": np.nan}, {"fluency_std": 0.0, "pronunciation_std": 0.0}

    feats = _compute_base_features(y, sr, transcript, top_db)
    scores = _scores_from_feats(feats)
    unc = _bootstrap_uncert(y, sr, transcript, top_db, n=8, seed=7)
    return feats, scores, unc

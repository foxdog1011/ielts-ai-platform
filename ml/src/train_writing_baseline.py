import os, json, time
import numpy as np
import pandas as pd
from pathlib import Path
from sentence_transformers import SentenceTransformer
from sklearn.metrics import mean_absolute_error
from xgboost import XGBRegressor
from metrics import quadratic_weighted_kappa

DATA_DIR = Path("data")
TRAIN_CSV = DATA_DIR / "asap_train.csv"
VALID_CSV = DATA_DIR / "asap_valid.csv"
ART_DIR   = Path("artifacts") / "writing_baseline"
ART_DIR.mkdir(parents=True, exist_ok=True)

EMB_MODEL = "sentence-transformers/all-MiniLM-L6-v2"  # 384 維，下載快

def _simple_features(texts: list[str]) -> np.ndarray:
    import re
    feats = []
    for t in texts:
        words = t.split()
        n_words = len(words)
        n_chars = len(t)
        avg_wlen = (sum(len(w) for w in words) / max(1, n_words))
        uniq_ratio = len(set(w.lower() for w in words)) / max(1, n_words)
        # 估句數：用標點切分
        sents = re.split(r"[.!?]+", t)
        sents = [s.strip() for s in sents if s.strip()]
        n_sents = max(1, len(sents))
        avg_sent_len = n_words / n_sents
        feats.append([n_words, n_chars, avg_wlen, uniq_ratio, n_sents, avg_sent_len])
    return np.array(feats, dtype=float)

def _embed(texts: list[str]) -> np.ndarray:
    model = SentenceTransformer(EMB_MODEL)
    embs = model.encode(texts, batch_size=64, show_progress_bar=True, convert_to_numpy=True, normalize_embeddings=False)
    return embs

def _to_raw_scale(pred_norm01: np.ndarray, score_min: np.ndarray, score_max: np.ndarray) -> np.ndarray:
    pred_norm01 = np.clip(pred_norm01, 0.0, 1.0)
    return score_min + pred_norm01 * (score_max - score_min)

def main():
    t0 = time.time()
    assert TRAIN_CSV.exists() and VALID_CSV.exists(), "請先跑 make prep_writing 產生 csv"

    train = pd.read_csv(TRAIN_CSV)
    valid = pd.read_csv(VALID_CSV)

    X_text_train = train["essay"].astype(str).tolist()
    X_text_valid = valid["essay"].astype(str).tolist()

    print(f"[INFO] 抽嵌入（{EMB_MODEL}）...")
    E_tr = _embed(X_text_train)
    E_va = _embed(X_text_valid)

    print("[INFO] 計算簡單特徵...")
    F_tr = _simple_features(X_text_train)
    F_va = _simple_features(X_text_valid)

    X_tr = np.hstack([E_tr, F_tr])
    X_va = np.hstack([E_va, F_va])
    y_tr = train["score_norm01"].values.astype(float)
    y_va = valid["score_norm01"].values.astype(float)

    print("[INFO] 訓練 XGBoost 回歸器...")
    model = XGBRegressor(
        n_estimators=600,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        reg_lambda=1.0,
        tree_method="hist",
        random_state=42,
        n_jobs=4
    )
    model.fit(X_tr, y_tr)

    # 預測 & 評估（MAE on norm01 + QWK after mapping back and rounding）
    pred_va_norm = model.predict(X_va)
    # 回到 raw 分數刻度後，四捨五入到整數
    raw_pred = _to_raw_scale(pred_va_norm, valid["score_min"].values, valid["score_max"].values)
    raw_pred_round = np.rint(raw_pred).astype(int)

    mae_norm = mean_absolute_error(y_va, np.clip(pred_va_norm,0,1))
    qwk = quadratic_weighted_kappa(valid["domain1_score"].astype(int).values, raw_pred_round)

    print(f"[RESULT] Val MAE(norm01) = {mae_norm:.4f}")
    print(f"[RESULT] Val QWK(raw integer) = {qwk:.4f}")
    print(f"[TIME] total = {time.time()-t0:.1f}s")

    # 存檔
    model.save_model(str(ART_DIR / "xgb.json"))
    meta = {
        "embedding_model": EMB_MODEL,
        "feature_names": ["emb_384_dims", "n_words", "n_chars", "avg_wlen", "uniq_ratio", "n_sents", "avg_sent_len"],
        "train_rows": int(len(train)),
        "valid_rows": int(len(valid))
    }
    with open(ART_DIR / "meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"[OK] 已儲存模型到 {ART_DIR}/")
    print("你可以先用這顆模型當 Writing baseline，之後再做 band 校準。")

if __name__ == "__main__":
    main()

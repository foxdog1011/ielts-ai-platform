"""FastAPI microservice wrapping IELTS ML scoring (XGBoost + librosa)."""
from __future__ import annotations

import logging
import os
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Ensure the sibling `src/` package is importable so we can reuse
# speech_features.extract_features without duplicating logic.
# ---------------------------------------------------------------------------
_ML_ROOT = Path(__file__).resolve().parent.parent
_SRC_DIR = _ML_ROOT / "src"
if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))

from sentence_transformers import SentenceTransformer  # noqa: E402
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS  # noqa: E402
from speech_features import extract_features  # noqa: E402
from xgboost import XGBRegressor  # noqa: E402

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ml-api")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
ART_DIR = _ML_ROOT / "artifacts" / "writing_baseline"
EMB_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
ALLOWED_ORIGINS = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:3000,https://*.vercel.app",
).split(",")

# ---------------------------------------------------------------------------
# Application-level singletons (loaded once at startup)
# ---------------------------------------------------------------------------


@dataclass
class _ModelStore:
    """Immutable-ish holder for lazily loaded models."""

    xgb: Optional[XGBRegressor] = None
    embedder: Optional[SentenceTransformer] = None
    xgb_loaded: bool = False
    embedder_loaded: bool = False


_store = _ModelStore()


def _get_embedder() -> SentenceTransformer:
    if _store.embedder is None:
        logger.info("Loading SentenceTransformer: %s", EMB_MODEL_NAME)
        _store.embedder = SentenceTransformer(EMB_MODEL_NAME)
        _store.embedder_loaded = True
    return _store.embedder


def _get_writing_model() -> Optional[XGBRegressor]:
    if _store.xgb is not None:
        return _store.xgb
    model_path = ART_DIR / "xgb.json"
    if not model_path.exists():
        logger.warning("XGBoost model not found at %s (skipping)", model_path)
        return None
    logger.info("Loading XGBoost model from %s", model_path)
    m = XGBRegressor()
    m.load_model(str(model_path))
    _store.xgb = m
    _store.xgb_loaded = True
    return m


# ---------------------------------------------------------------------------
# Scoring helpers (mirrored from score_cli.py, kept pure/functional)
# ---------------------------------------------------------------------------

import re  # noqa: E402


def _simple_text_feats(text: str) -> np.ndarray:
    words = text.split()
    n_words = len(words)
    n_chars = len(text)
    avg_wlen = sum(len(w) for w in words) / max(1, n_words)
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


def _predict_content_norm(text: str, model: XGBRegressor) -> float:
    embedder = _get_embedder()
    emb = embedder.encode([text], batch_size=1, show_progress_bar=False, convert_to_numpy=True)
    feats = _simple_text_feats(text)[:6]  # first 6 features (matches training)
    x = np.hstack([emb, feats.reshape(1, -1)])
    y = float(model.predict(x)[0])
    if not np.isfinite(y):
        y = 0.0
    return float(np.clip(y, 0.0, 1.0))


def _to_band_0_9(overall_01: float) -> float:
    band = 4.0 + 5.0 * float(np.clip(overall_01, 0, 1))
    return float(np.round(band * 2) / 2)


def _nan_to_none(x: Optional[float]) -> Optional[float]:
    if x is None:
        return None
    try:
        return None if (not np.isfinite(x)) else float(x)
    except Exception:
        return None


def _safe_extract_speaking(
    audio_path: str, transcript: Optional[str] = None
) -> Tuple[Dict[str, Any], Dict[str, float]]:
    res = extract_features(audio_path, transcript=transcript)

    feats: Dict[str, Any] = {}
    scores_raw: Dict[str, Any] = {}

    if isinstance(res, tuple):
        if len(res) >= 2:
            feats, scores_raw = res[0], res[1]
        elif len(res) == 1:
            feats, scores_raw = res[0], {}
        else:
            feats, scores_raw = {}, {}
    elif isinstance(res, dict):
        feats = res.get("features", res)
        scores_raw = res.get("scores", {})
    else:
        feats, scores_raw = {}, {}

    def pick(d: Dict[str, Any], names: list[str]) -> Optional[float]:
        for n in names:
            if n in d and d[n] is not None:
                try:
                    return float(d[n])
                except Exception:
                    pass
        return None

    flu = pick(scores_raw, ["fluency_01", "fluency_norm", "fluency_score", "fluency"])
    pro = pick(
        scores_raw,
        ["pronunciation_01", "pron_norm", "pronunciation_score", "pronunciation", "pron_score"],
    )

    norm_scores = {
        "fluency_01": _nan_to_none(flu),
        "pronunciation_01": _nan_to_none(pro),
    }
    return feats or {}, norm_scores


def _fuse_scores(
    content_score: Optional[float],
    fluency_score: Optional[float],
    pronunciation_score: Optional[float],
) -> Tuple[float, float]:
    """Return (overall_01, band_estimate). Raises ValueError when no scores available."""
    parts: list[Tuple[str, float, float]] = []
    if content_score is not None:
        parts.append(("content", content_score, 0.35))
    if fluency_score is not None:
        parts.append(("fluency", fluency_score, 0.35))
    if pronunciation_score is not None:
        parts.append(("pronunciation", pronunciation_score, 0.30))
    if not parts:
        raise ValueError("No subscores available")
    w_sum = sum(w for _, _, w in parts)
    overall = sum(v * (w / w_sum) for _, v, w in parts)
    if not np.isfinite(overall):
        overall = 0.0
    overall = float(np.clip(overall, 0.0, 1.0))
    return overall, _to_band_0_9(overall)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class WritingRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Essay or writing text")
    prompt: Optional[str] = Field(None, description="Optional writing prompt")


class SubscoresResponse(BaseModel):
    content: Optional[float] = None
    fluency: Optional[float] = None
    pronunciation: Optional[float] = None


class WritingResponse(BaseModel):
    subscores_01: SubscoresResponse
    overall_01: float
    band_estimate: float


class SpeakingResponse(BaseModel):
    subscores_01: SubscoresResponse
    speaking_features: Dict[str, Any] = {}
    overall_01: float
    band_estimate: float


class HealthResponse(BaseModel):
    ok: bool
    model_loaded: bool


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(title="IELTS ML Scoring Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup() -> None:
    """Eagerly load models so the first request is fast."""
    _get_writing_model()
    _get_embedder()
    logger.info("Startup complete. XGB loaded: %s", _store.xgb_loaded)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(ok=True, model_loaded=_store.xgb_loaded)


@app.post("/score/writing", response_model=WritingResponse)
async def score_writing(req: WritingRequest) -> WritingResponse:
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="text must not be empty")

    model = _get_writing_model()
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Writing model not available (xgb.json not found)",
        )

    try:
        content_01 = _predict_content_norm(text, model)
    except Exception as exc:
        logger.error("Writing scoring failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Scoring error: {exc}") from exc

    overall, band = _fuse_scores(content_score=content_01, fluency_score=None, pronunciation_score=None)
    return WritingResponse(
        subscores_01=SubscoresResponse(content=_nan_to_none(content_01)),
        overall_01=overall,
        band_estimate=band,
    )


@app.post("/score/speaking", response_model=SpeakingResponse)
async def score_speaking(
    audio: UploadFile = File(...),
    transcript: Optional[str] = Form(None),
) -> SpeakingResponse:
    # Write uploaded audio to a temp file so librosa can read it
    suffix = Path(audio.filename or "audio.wav").suffix or ".wav"
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await audio.read()
            tmp.write(content)
            tmp_path = tmp.name
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read audio: {exc}") from exc

    # Content scoring from transcript
    content_score: Optional[float] = None
    text_for_content = transcript or ""
    if text_for_content.strip():
        try:
            wm = _get_writing_model()
            if wm is not None:
                content_score = _predict_content_norm(text_for_content, wm)
        except Exception as exc:
            logger.warning("Content scoring skipped: %s", exc)

    # Speaking features
    fluency_score: Optional[float] = None
    pronunciation_score: Optional[float] = None
    spk_feats: Dict[str, Any] = {}
    try:
        spk_feats, spk_scores = _safe_extract_speaking(tmp_path, transcript=transcript)
        fluency_score = spk_scores.get("fluency_01")
        pronunciation_score = spk_scores.get("pronunciation_01")
    except Exception as exc:
        logger.error("Speech feature extraction failed: %s", exc, exc_info=True)
    finally:
        # Clean up temp file
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass

    try:
        overall, band = _fuse_scores(content_score, fluency_score, pronunciation_score)
    except ValueError:
        raise HTTPException(status_code=422, detail="No subscores could be computed from input")

    # Sanitize spk_feats: convert any numpy/nan values to JSON-safe types
    safe_feats: Dict[str, Any] = {}
    for k, v in spk_feats.items():
        if isinstance(v, (np.floating, float)):
            safe_feats[k] = None if (not np.isfinite(v)) else float(v)
        elif isinstance(v, (np.integer, int)):
            safe_feats[k] = int(v)
        else:
            safe_feats[k] = v

    return SpeakingResponse(
        subscores_01=SubscoresResponse(
            content=_nan_to_none(content_score),
            fluency=_nan_to_none(fluency_score),
            pronunciation=_nan_to_none(pronunciation_score),
        ),
        speaking_features=safe_feats,
        overall_01=overall,
        band_estimate=band,
    )

# IELTS AI Platform

An AI-powered IELTS practice platform with real-time Writing and Speaking feedback, dual-engine scoring, and a full question bank — built as a Next.js monorepo.

---

## Features

### Writing Task 2
- Word count & duration tracking
- Pre-submission validation
- AI band scoring across all four IELTS criteria:
  - Task Response · Coherence & Cohesion · Lexical Resource · Grammatical Range & Accuracy
- Per-paragraph comments, improvement suggestions, and a rewritten essay

### Speaking (Part 1 / 2 / 3)
- Randomised question draw from seeded or AI-generated question bank
- Audio upload + automatic transcription (via OpenAI ASR)
- AI feedback with band scoring and follow-up prompts

### Dual-Engine Fused Scoring
- **LLM engine** — GPT-4o-based qualitative assessment
- **ML baseline engine** — local XGBoost + sentence-transformers producing 0–1 subscores
- Scores are fused and calibrated to the IELTS 4.0–9.0 band scale via `quantile_map.json`
- Trace persistence: every scoring run is stored for audit/review

### History
- All Writing & Speaking attempts auto-saved to Vercel KV (in-memory fallback in dev)
- Homepage displays recent cards with band scores, word count, duration, and timestamp

### Question Bank
- `POST /api/prompts/seed` — seed initial prompt set
- `POST /api/prompts/generate` — AI-generate new prompts (type + part filtering)
- `GET /api/prompts/random` — draw a random prompt

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend / API | Next.js 14 (App Router) + TypeScript |
| Styling | TailwindCSS v4 |
| AI | OpenAI SDK v5 (GPT-4o / GPT-4o-mini) |
| Persistence | Vercel KV (Upstash Redis) |
| ML Baseline | Python · XGBoost · sentence-transformers · librosa |
| Monorepo | Yarn Workspaces + Turborepo |
| Validation | Zod |

---

## Project Structure

```
.
├── apps/
│   └── web/                  # Next.js app (App Router + API routes)
│       ├── app/
│       │   ├── api/          # writing · speaking · prompts · history · health · upload-audio
│       │   ├── tasks/        # Writing & Speaking task pages
│       │   ├── history/      # History browser
│       │   └── result/       # Score result display
│       └── lib/              # kv.ts · promptStore.ts · scoring utilities
├── ml/                       # Python ML baseline
│   ├── src/
│   │   ├── score_cli.py      # CLI: text + audio → subscores + band estimate
│   │   └── speech_features.py# WPM · pause ratio · F0 · energy extraction
│   ├── artifacts/            # Trained model weights (xgb.json)
│   └── data/                 # Training datasets
├── packages/
│   └── types/                # Shared TypeScript types
├── package.json              # Workspace root
└── tsconfig.base.json
```

---

## Quick Start

```bash
# 1. Install dependencies
yarn

# 2. Set up environment variables
cp apps/web/.env.local.example apps/web/.env.local
# Edit the file and fill in your keys (see Environment Variables below)

# 3. Start dev server
yarn dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Create `apps/web/.env.local`:

```env
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
TEMPERATURE=0.2
REQUEST_TIMEOUT_MS=30000

# Vercel KV — omit to use in-memory fallback
KV_REST_API_URL=https://...upstash.io
KV_REST_API_TOKEN=...

# Local ML baseline — omit to use LLM-only scoring
ML_CWD=/absolute/path/to/ml
PYTHON_BIN=/absolute/path/to/ml/.venv/bin/python

# Security: restrict accepted audio upload paths
ALLOWED_AUDIO_ROOTS=/absolute/path/to/ml

# ASR model (used when transcript is missing)
ASR_MODEL=gpt-4o-mini-transcribe
```

---

## ML Baseline Setup

The Python baseline provides quantifiable subscores for writing content, speaking fluency, and pronunciation. The Next.js API detects baseline availability automatically and falls back to LLM-only if unavailable.

```bash
cd ml
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

pip install -U pip
pip install -r requirements.txt
# or manually: xgboost sentence-transformers numpy scikit-learn librosa soundfile
```

Train the writing model (if `artifacts/writing_baseline/xgb.json` is missing):

```bash
make train_writing
```

Run the scoring CLI directly:

```bash
# Writing
python ml/src/score_cli.py --text "Your essay..."

# Speaking (with audio)
python ml/src/score_cli.py \
  --audio /path/to/audio.wav \
  --transcript "Transcript..." \
  --out /tmp/result.json
```

Sample output:

```json
{
  "subscores_01": { "content": 0.30, "fluency": 0.81, "pronunciation": 0.37 },
  "speaking_features": { "wpm": 150, "pause_ratio": 0.01, "f0_std_hz": 63.7 },
  "overall_01": 0.50,
  "band_estimate": 6.5
}
```

### Score Calibration

Band calibration is read from `apps/web/public/calibration/quantile_map.json`. To update:

1. Run the baseline over a large unlabelled corpus to collect `overall_01` values.
2. Compute percentiles (p10–p90) and map them to band 4.0–9.0.
3. Replace `quantile_map.json` with the new mapping.

`GET /api/health` reports whether calibration loaded successfully.

---

## API Reference

### `POST /api/writing`

```json
// Request
{
  "taskId": "task-2",
  "prompt": "IELTS prompt text",
  "essay": "User essay",
  "seconds": 2400,
  "targetWords": 250
}

// Response
{
  "ok": true,
  "data": {
    "band": {
      "overall": 6.5,
      "taskResponse": 6.0,
      "coherence": 6.5,
      "lexical": 6.5,
      "grammar": 6.0
    },
    "paragraphFeedback": [{ "index": 0, "comment": "..." }],
    "improvements": ["..."],
    "rewritten": "Improved essay text"
  }
}
```

### `POST /api/speaking`

```json
// Request
{
  "taskId": "speaking-part-2",
  "audioPath": "/allowed/path/audio.wav",
  "transcript": "Transcript text"
}

// Response
{
  "ok": true,
  "data": {
    "band": { "overall": 6.0, "fluency": 0.81, "pronunciation": 0.37, ... },
    "speakingFeatures": { "wpm": 150, "pause_ratio": 0.01 },
    "feedback": "..."
  }
}
```

### `GET /api/history`

Returns the last N saved Writing and Speaking results.

### `GET /api/health`

Returns system status: OpenAI connectivity, KV availability, ML baseline presence, calibration load status.

---

## Roadmap

- [x] Writing Task 2 feedback (scores, improvements, rewritten essay)
- [x] Speaking tasks — question bank, audio upload, ASR, scoring
- [x] History tracking (Writing & Speaking)
- [x] Prompts API — seed / generate / random draw
- [x] Local ML baseline + band calibration
- [x] Dual-engine fused scoring with trace persistence
- [ ] Progress charts & band trend visualization
- [ ] Improved ASR alignment for Speaking accuracy
- [ ] User accounts & authentication

---

## License

MIT © 2025 foxdog

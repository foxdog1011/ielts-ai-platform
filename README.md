# IELTS AI Platform

> Next.js monorepo for IELTS Writing & Speaking AI feedback

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [ML Baseline (Python) & Training](#ml-baseline-python--training)
  - [Directory & Artifacts](#directory--artifacts)
  - [Create venv & Install](#create-venv--install)
  - [Train Writing Baseline](#train-writing-baseline)
  - [Run Local Scoring CLI](#run-local-scoring-cli)
  - [Calibration (quantile_map.json)](#calibration-quantile_mapjson)
- [Development Workflow](#development-workflow)
- [API Contract](#api-contract)
  - [/api/writing (Writing Task)](#apiwriting-writing-task)
  - [/api/speaking (Speaking Task)](#apispeaking-speaking-task)
  - [/api/prompts/* (Question Bank)](#apiprompts-question-bank)
- [Types & Validation](#types--validation)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

This project is the **IELTS AI Feedback Platform**, designed to simulate IELTS exam practice with **AI scoring, feedback, and question generation**.

- **Writing Task 2**: Real-time validation, AI band score evaluation, per-paragraph feedback, improvements, and an optimized rewritten essay.
- **Speaking**: Randomized questions (Part 1/2/3), AI scoring, feedback, and follow-up prompts.
- **History Tracking**: All attempts are saved in **Vercel KV** (or memory fallback), displayed on the homepage.
- **Question Bank**: Supports **seeded questions** + **AI-generated prompts**, and random draw.

**Tech stack**:  
`Next.js (App Router) + TypeScript + TailwindCSS + Vercel KV + OpenAI SDK v5 + Python (XGBoost / sentence-transformers)`

---

## Features

### Writing
- Word counting and duration tracking
- Pre-submission validation
- AI Band feedback:
  - Task Response
  - Coherence & Cohesion
  - Lexical Resource
  - Grammar
- Extra features:
  - Per-paragraph comments
  - Suggested improvements
  - Optimized rewritten essay
- Scores saved into history and displayed on the homepage

### Speaking
- Random draw from **seeded** or **AI-generated** question bank
- Part 1 / Part 2 / Part 3 support
- Follow-up questions
- AI feedback with scoring
- History tracking

### History
- Writing / Speaking results saved automatically
- Displayed on homepage in recent cards
- Includes:
  - Band scores
  - Task ID & prompt
  - Word count / duration
  - Timestamp

### Prompts / Question Bank
- `POST /api/prompts/seed` → Seed initial prompts
- `POST /api/prompts/generate` → Generate prompts using AI
- `GET /api/prompts/random` → Randomly draw prompts (writing/speaking)
- Supports `type` and `part` parameters for filtering

---

## Project Structure

```
.
├─ apps/
│  └─ web/                # Next.js frontend (App Router + API routes)
├─ ml/                    # Python baseline: content/fluency/pronunciation & CLI
│  ├─ artifacts/          # Trained models (e.g. writing_baseline/xgb.json)
│  ├─ data/               # Local datasets / raw samples
│  └─ src/
│     ├─ score_cli.py     # Main CLI: text + audio → subscores + band
│     └─ speech_features.py # Extracts WPM, pauses, F0, energy → fluency & pronunciation
├─ packages/
│  └─ types/              # Shared TypeScript types
├─ .gitignore
├─ package.json           # Monorepo workspace config
├─ tsconfig.base.json
└─ yarn.lock / pnpm-lock.yaml
```

---

## Quick Start

```bash
# 1) Install dependencies
yarn       # or: pnpm install / npm install

# 2) Copy envs
cp apps/web/.env.local.example apps/web/.env.local
# (Fill in OpenAI key, Vercel KV, and local ML paths if using baseline scoring)

# 3) Development (web only)
yarn dev -w apps/web

# 4) Production (web)
yarn build -w apps/web
yarn start -w apps/web
```

## Environment Variables

Set in `apps/web/.env.local` (dev) or Vercel project env (prod):

```env
# OpenAI (Responses API via openai@^5)
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o-mini
TEMPERATURE=0.2
REQUEST_TIMEOUT_MS=30000

# Vercel KV (optional; fallback = in-memory)
KV_REST_API_URL=https://.....upstash.io
KV_REST_API_TOKEN=xxxxxxxxxxxxxxxx

# —— Local ML baseline (optional but recommended in dev) ——
ML_CWD=/home/<you>/ielts-ai-monorepo/ml
PYTHON_BIN=/home/<you>/ielts-ai-monorepo/ml/.venv/bin/python

# Restrict accepted audio paths (security)
ALLOWED_AUDIO_ROOTS=/home/<you>/ielts-ai-monorepo/ml

# (Optional) ASR model if transcript is missing
ASR_MODEL=gpt-4o-mini-transcribe
```

## ML Baseline (Python) & Training

This project includes a local Python baseline that maps quantifiable Writing/Speaking features to 0–1 subscores, then calibrates them to IELTS band range (4.0–9.0). The Next.js API auto-detects baseline availability; otherwise it falls back to LLM-only.

### Directory & Artifacts

- Model artifact: `ml/artifacts/writing_baseline/xgb.json` (XGBoost regressor)
- Embedding: `sentence-transformers/all-MiniLM-L6-v2`
- Speech features: `ml/src/speech_features.py` (WPM, pause ratio, F0, energy, etc.)

### Create venv & Install

```bash
cd ml
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip

# If requirements.txt exists
pip install -r requirements.txt

# Otherwise install main deps manually
pip install xgboost sentence-transformers numpy scikit-learn librosa soundfile
```

### Train Writing Baseline

`score_cli.py` extracts:

- Text features: n_words, n_chars, avg_wlen, uniq_ratio, n_sents, avg_sent_len, stop_ratio
- Sentence embeddings: all-MiniLM-L6-v2
- Model: XGBRegressor → content_score ∈ [0,1]

Artifacts expected at:

```bash
ml/artifacts/writing_baseline/xgb.json
```

If missing, run:

```bash
make train_writing
```

### Run Local Scoring CLI

```bash
# Text-only (writing)
ml/.venv/bin/python ml/src/score_cli.py \
  --text "Your essay or transcript here..."

# Audio-only (speaking)
ml/.venv/bin/python ml/src/score_cli.py \
  --audio /abs/path/to/audio.wav \
  --transcript "Transcript text..."

# Combined (text + audio)
ml/.venv/bin/python ml/src/score_cli.py \
  --text "..." \
  --audio /abs/path/to/audio.wav \
  --transcript "..." \
  --out /tmp/result.json
```

Sample output:

```json
{
  "subscores_01": {
    "content": 0.30,
    "fluency": 0.81,
    "pronunciation": 0.37
  },
  "speaking_features": {
    "wpm": 150,
    "pause_ratio": 0.01,
    "f0_std_hz": 63.7,
    "energy_std": 0.10
  },
  "overall_01": 0.50,
  "band_estimate": 6.5
}
```

### Calibration (quantile_map.json)

Frontend reads calibration mapping from `apps/web/public/calibration/quantile_map.json`.

Steps to update:

1. Run baseline on large unlabelled data to collect `overall_01` distribution.
2. Compute percentiles (e.g., p10–p90) → map to band 4.0–9.0.
3. Generate a new `quantile_map.json`.

`/api/health` shows whether calibration was loaded successfully.

## Development Workflow

- Linting & formatting: ESLint + Prettier
- API response format:

```json
{ "ok": true, "data": { ... } }
```

or

```json
{ "ok": false, "error": { "code": "BAD_REQUEST", "message": "..." } }
```

- History storage: `lib/kv.ts` → `saveScore()` (KV or in-memory)
- Prompt management: `lib/promptStore.ts` → seed / savePromptsUniq / listPrompts

Root scripts:

```json
{
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "lint": "turbo run lint"
  }
}
```

## API Contract

### `/api/writing` (Writing Task)

**Method:** POST

**Body:**

```json
{
  "taskId": "task-2",
  "prompt": "IELTS writing prompt...",
  "essay": "User's essay text...",
  "seconds": 120,
  "targetWords": 250
}
```

**Response:**

```json
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
    "paragraphFeedback": [
      { "index": 0, "comment": "Intro is clear; consider a stronger thesis." }
    ],
    "improvements": ["Use more varied complex sentences."],
    "rewritten": "Improved essay text...",
    "tokensUsed": 1234
  }
}
```

### `/api/speaking` (Speaking Task)

**Method:** POST

**Body:**

```json
{
  "taskId": "speaking-part-2",
  "audioPath": "/abs/path/in/ALLOWED_AUDIO_ROOTS.wav",
  "transcript": "Transcript text..."
}
```

**Response:**

```json
{
  "ok": true,
  "data": {
    "band": {
      "overall": 6.0,
      "content": 0.2,
      "grammar": 0.3,
      "vocab": 0.4,
      "fluency": 0.81,
      "pronunciation": 0.37
    },
    "speakingFeatures": {
      "wpm": 150,
      "pause_ratio": 0.01,
      "f0_std_hz": 63.78
    },
    "feedback": "Concise feedback...",
    "tokensUsed": 300
  }
}
```

### `/api/prompts/*` (Question Bank)

- **POST /api/prompts/seed** → Initialize seed prompts
- **POST /api/prompts/generate** → Generate new prompts with AI (writing/speaking, part-specific)
- **GET /api/prompts/random?type=writing&part=task2** → Random draw (falls back to seed if empty)

## Types & Validation

- Requests: validated with zod
- LLM output: validated with JSON Schema + clamping to prevent format drift

## Roadmap

- ✅ Writing feedback: scores, improvements, rewritten essay
- ✅ Speaking tasks: seed/AI question bank, scoring
- ✅ History tracking (Writing & Speaking)
- ✅ Prompts API: seed / generate / random
- ✅ Local ML baseline + calibration
- ⏳ Progress visualization & charts
- ⏳ Improved ASR alignment for Speaking

## License

MIT License © 2025 foxdog
# IELTS AI Platform

> Full-stack AI coaching platform for IELTS Writing and Speaking — built with a dual-engine scoring architecture that combines GPT-4o with a local ML baseline (XGBoost + librosa), fused by confidence-weighted averaging and calibrated to the official 4.0–9.0 band scale.

![Next.js](https://img.shields.io/badge/Next.js_15-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript_5-3178C6?style=flat&logo=typescript&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI_GPT--4o-412991?style=flat&logo=openai&logoColor=white)
![Python](https://img.shields.io/badge/Python_ML-3776AB?style=flat&logo=python&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS_v4-38BDF8?style=flat&logo=tailwindcss&logoColor=white)

---

## What This Project Demonstrates

This is a **production-architecture side project** built to practice end-to-end AI system design. It goes beyond simple LLM API wrappers and implements:

- **Dual-engine scoring** — LLM and local ML run in parallel; results fused by per-dimension confidence weights
- **Multi-agent orchestration pipeline** — sequential agents (Diagnosis → Planner → Reviewer) with error isolation
- **Cross-session learning analytics** — persistent anomaly codes detect recurring weaknesses across practice sessions
- **Explainable scoring** — every band score ships with a full audit trace (weights, timings, model attribution)
- **Adaptive fallback chains** — graceful degradation from dual-engine → LLM-only → safe null, never a hallucinated score

---

## System Architecture

```
User Input (essay / audio)
        │
        ▼
┌───────────────────────────────────────────────┐
│              Scoring Pipeline                 │
│                                               │
│  ┌──────────────┐    ┌───────────────────┐   │
│  │  LLM Engine  │    │  Local ML Engine  │   │
│  │  (GPT-4o)    │    │  XGBoost + librosa│   │
│  │              │    │                   │   │
│  │ Writing:     │    │ Writing:          │   │
│  │ TR·CC·LR·GRA │    │ content_01        │   │
│  │              │    │                   │   │
│  │ Speaking:    │    │ Speaking:         │   │
│  │ Content      │    │ Fluency (WPM,     │   │
│  │ Grammar      │    │  pause ratio)     │   │
│  │ Vocabulary   │    │ Pronunciation     │   │
│  │              │    │ (F0, energy)      │   │
│  └──────┬───────┘    └────────┬──────────┘   │
│         │  confidence weight  │              │
│         └─────────┬───────────┘              │
│                   ▼                          │
│         Confidence-Weighted Fusion           │
│                   │                          │
│                   ▼                          │
│         Quantile Band Calibration            │
│         (0–1 raw → 4.0–9.0 IELTS band)       │
│                   │                          │
│                   ▼                          │
│        Heuristic Diagnosis Engine            │
│   (anomaly detection, zero-latency, sync)    │
└───────────────────┬───────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  Agent Orchestrator   │
        │                       │
        │  1. DiagnosisAgent    │  ← enriches anomalies, prosodic audit
        │  2. PlannerAgent      │  ← recurring-boost, study plan
        │  3. ReviewerAgent     │  ← 8-rule consistency validation
        └───────────┬───────────┘
                    │
                    ▼
        Score + Trace + Study Plan
        persisted to Vercel KV
```

---

## Key Engineering Decisions

### 1. Asymmetric Dimension Ownership

Rather than routing all dimensions through one engine, each dimension is owned by the engine best suited to it:

| Dimension | Owner | Rationale |
|---|---|---|
| Task Response · Coherence · Lexical · Grammar | LLM | Semantic understanding requires language model |
| Fluency (WPM, pause ratio, avg pause duration) | Local ML | Prosodic signals are invisible to text-based LLMs |
| Pronunciation (F0 variance, spectral energy) | Local ML | Acoustic features only extractable from raw audio |

When both engines produce a dimension score, they are blended:
```
fused = (llm_score × llm_conf + local_score × local_conf) / (llm_conf + local_conf)
```
If one engine is unavailable, the other's confidence dominates automatically — no hard-coded fallback logic needed.

### 2. Confidence Penalty System

Input quality dynamically reduces LLM confidence to prevent unreliable scores from polluting the fused output:

```typescript
if (essayWords < 80)       llmConfidence *= 0.6   // short essay: less signal
if (transcriptWords < 12)  llmConfidence  = 0.2   // near-empty: floor confidence
if (!audioAvailable)       localConfidence = 0.0   // no audio: ML fluency/pronunciation excluded
```

The final calibrated band is never emitted if both engines return null — safe failure over hallucination.

### 3. Multi-Agent Orchestration

Four agents run in strict dependency order, each wrapped in `.catch()` for error isolation:

```
DiagnosisAgent  →  PlannerAgent  →  ReviewerAgent
     ↓                  ↓                ↓
  anomaly codes    study plan       8-rule validator
  prosodic audit   recurring boost  conflict detection
  evidence summary IELTS weights    synthetic-input flag
```

**ReviewerAgent** checks 8 consistency rules including:
- `HIGH_SEVERITY_NO_FOCUS` — severe anomalies not reflected in study plan
- `BOOST_INCONSISTENCY` — recurring boost applied without matching anomaly codes
- `ALL_BANDS_EQUAL` — flat subscores indicating synthetic/test input
- `DIAGNOSIS_PLANNER_MISMATCH` — top weaknesses absent from priority dimensions

Failures surface as `reviewNotes` (severity: info / warning / block) rather than crashing the route.

### 4. Cross-Session Recurring Weakness Detection

Anomaly codes (e.g. `VERY_LOW_SUBSCORE`, `FLUENCY_CONTENT_MISMATCH`) are persisted to Vercel KV with each score record. The DiagnosisAgent queries the last 5 sessions of the same exam type and detects patterns:

```typescript
// A weakness is "recurring" if it appears in 2+ prior sessions
const recurring = Object.entries(codeCounts)
  .filter(([_, count]) => count >= 2)
  .map(([code]) => code);
```

When recurring issues are detected, PlannerAgent overrides `currentFocus` with `reason: "repeated_weakness"` — distinguishing persistent patterns from single-session noise.

### 5. Full Audit Trace

Every API response includes a `ScoreTrace` capturing the complete scoring lineage:

```typescript
{
  llm_subscores:              { taskResponse: 0.71, coherence: 0.68, ... },
  local_subscores:            { content: 0.54 },
  weights:                    { taskResponse: { llm: 0.9, local: 0.1, combined: 1.0 } },
  final_overall_pre_calibration:  0.69,
  final_overall_post_calibration: 0.65,
  final_band:                 6.5,
  debug_flags:                { short_essay: false, low_llm_confidence: false },
  timings:                    { local_ms: 42, llm_ms: 1180, total_ms: 1222 },
  models:                     { llm_model: "gpt-4o-mini", local_model: "score_cli.py" }
}
```

### 6. Quantile-Based Band Calibration

Raw 0–1 scores are non-linearly mapped to IELTS bands via interpolation over pre-computed quantile pairs:

```typescript
// Snap to nearest 0.5 IELTS band increment
const ratio = (x - pairs[i-1].x) / (pairs[i].x - pairs[i-1].x);
const band  = pairs[i-1].band + (pairs[i].band - pairs[i-1].band) * ratio;
return Math.round(band * 2) / 2;
```

Calibration data lives in `public/calibration/quantile_map.json` and is regenerated from the Python pipeline via `make calibrate`.

### 7. Dependency-Injected Pipeline (Testable by Design)

All pipeline functions accept optional `deps` for full unit-test isolation without mocking static singletons:

```typescript
export async function runWritingPipeline(
  input: WritingPipelineInput,
  deps?: {
    localFn?:     (input: LocalWritingInput)  => Promise<LocalWritingOutput | null>;
    llmFn?:       (input: LlmWritingInput)    => Promise<LlmWritingOutput | null>;
    diagnosisFn?: (input: DiagnosisInput)     => DiagnosisResult;
    openaiClient?: OpenAI;
    now?:         () => number;
  }
)
```

### 8. KV Abstraction with HMR-Safe Dev Fallback

```typescript
// In dev, globalThis survives Next.js hot-module reloads
const store: Map<string, string> = (globalThis as any).__kvStore ??= new Map();
```

The same `kvSetJSON` / `kvGetJSON` / `kvListPushJSON` interface works against Vercel KV (Upstash Redis) in production and the in-memory map in development — zero environment-specific branching in application code.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend / API | Next.js 15.4 (App Router) · TypeScript 5 |
| Styling | TailwindCSS v4 |
| LLM Engine | OpenAI SDK v5 — GPT-4o / GPT-4o-mini (JSON mode) |
| ASR | OpenAI `gpt-4o-mini-transcribe` |
| Local ML | Python · XGBoost · sentence-transformers · librosa · scikit-learn |
| Validation | Zod (runtime schema validation for all LLM outputs) |
| Persistence | Vercel KV (Upstash Redis) · in-memory Map fallback |
| Workflow Automation | n8n (Docker Compose) |
| Monorepo | Yarn Workspaces + Turborepo |

---

## Project Structure

```
.
├── apps/web/
│   ├── app/
│   │   ├── api/
│   │   │   ├── writing/          # POST — full pipeline + agent orchestration
│   │   │   ├── speaking/         # POST — audio → ASR → pipeline → agents
│   │   │   ├── history/          # GET  — paginated score history
│   │   │   ├── prompts/          # seed / generate / random / list / flag
│   │   │   ├── weekly-summary/   # aggregated progress report
│   │   │   ├── health/           # OpenAI · KV · ML · calibration status
│   │   │   └── upload-audio/     # path-validated audio intake
│   │   └── tasks/[id]/           # Writing & Speaking task pages
│   └── lib/
│       ├── scoring/
│       │   ├── writingPipeline.ts     # LLM + local + fusion + diagnosis + calibration
│       │   ├── speakingPipeline.ts
│       │   ├── writingFusion.ts       # Confidence-weighted dimension blending
│       │   ├── speakingFusion.ts
│       │   ├── calibration.ts         # Quantile map interpolation
│       │   ├── diagnosis.ts           # Zero-latency heuristic anomaly detector
│       │   ├── llmWritingRubric.ts    # GPT-4o JSON-mode rubric prompts + Zod validation
│       │   ├── llmSpeakingRubric.ts
│       │   └── asr.ts                 # Whisper transcription with fallback
│       ├── agents/
│       │   ├── orchestrator.ts        # Sequential pipeline, error-isolated
│       │   ├── diagnosisAgent.ts      # Anomaly enrichment + prosodic audit
│       │   ├── plannerAgent.ts        # Recurring-boost study plan builder
│       │   └── reviewerAgent.ts       # 8-rule consistency validator
│       ├── kv.ts                      # Vercel KV / in-memory unified interface
│       ├── planner.ts                 # Rule-based study plan generator
│       ├── coach.ts                   # Cross-session learner profile aggregator
│       └── weeklySummary.ts
├── ml/
│   ├── src/
│   │   ├── score_cli.py               # text + audio → subscores + speaking features
│   │   ├── speech_features.py         # WPM · pause ratio · F0 · spectral energy
│   │   ├── train_writing_baseline.py  # XGBoost content scorer
│   │   ├── train_speaking_features.py # Fluency/pronunciation regression models
│   │   └── calibrate_band.py          # Quantile map generation
│   ├── artifacts/                     # Trained model weights (xgb.json)
│   └── Makefile                       # download · train · calibrate targets
└── docker-compose.yml                 # n8n workflow service (port 5800)
```

---

## Quick Start

```bash
# 1. Install dependencies
yarn

# 2. Environment variables
cp apps/web/.env.local.example apps/web/.env.local
# Fill in OPENAI_API_KEY (required) — all other vars have safe defaults

# 3. Start dev server
cd apps/web && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

```env
# Required
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Optional — Vercel KV (omit to use in-memory fallback)
KV_REST_API_URL=https://...upstash.io
KV_REST_API_TOKEN=...

# Optional — Local ML baseline (omit for LLM-only mode)
ML_CWD=/absolute/path/to/ml
PYTHON_BIN=/absolute/path/to/ml/.venv/bin/python
ALLOWED_AUDIO_ROOTS=/absolute/path/to/uploads

# Optional
ASR_MODEL=gpt-4o-mini-transcribe
TEMPERATURE=0.2
REQUEST_TIMEOUT_MS=30000
```

### ML Baseline Setup

```bash
cd ml
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

make train_writing    # trains XGBoost on ASAP writing dataset
make calibrate        # regenerates quantile_map.json
```

The Next.js API auto-detects ML availability at startup (`GET /api/health`) and falls back to LLM-only scoring if the Python process is unreachable.

---

## API Reference

### `POST /api/writing`
```jsonc
// Request
{ "taskId": "task-2", "prompt": "...", "essay": "...", "seconds": 2400 }

// Response
{
  "ok": true,
  "data": {
    "band": { "overall": 6.5, "taskResponse": 6.0, "coherence": 6.5, "lexical": 6.5, "grammar": 6.0 },
    "paragraphFeedback": [{ "index": 0, "comment": "..." }],
    "improvements": ["..."],
    "rewritten": "...",
    "scoreTrace": { /* full audit trail */ },
    "studyPlan": { "currentFocus": "lexical", "reason": "repeated_weakness", ... }
  }
}
```

### `POST /api/speaking`
```jsonc
// Request
{ "taskId": "speaking-part-2", "audioPath": "/uploads/audio.wav", "transcript": "..." }

// Response
{
  "ok": true,
  "data": {
    "band": { "overall": 6.0, "fluency": 0.81, "pronunciation": 0.37, "content": 0.72 },
    "speakingFeatures": { "wpm": 150, "pause_ratio": 0.08, "f0_std_hz": 63.7 },
    "feedback": "...",
    "scoreTrace": { /* full audit trail */ }
  }
}
```

### `GET /api/health`
Reports live status of: OpenAI connectivity · Vercel KV · ML baseline · calibration map

---

## Roadmap

- [x] Writing Task 2 — scores, per-paragraph feedback, rewritten essay
- [x] Speaking Parts 1/2/3 — question bank, audio upload, ASR, scoring
- [x] Dual-engine fused scoring with confidence-weighted blending
- [x] Quantile-based band calibration
- [x] Full score audit trace
- [x] Multi-agent orchestration (Diagnosis → Planner → Reviewer)
- [x] Cross-session recurring weakness detection
- [x] Weekly progress summary
- [ ] Band trend visualization / progress charts
- [ ] User accounts & authentication

---

## License

MIT © 2025

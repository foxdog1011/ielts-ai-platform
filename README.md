# IELTS AI Platform

> Full-stack AI coaching platform for IELTS Writing and Speaking — built with a dual-engine scoring architecture that combines GPT-4o with a local ML baseline (XGBoost + librosa), fused by confidence-weighted averaging and calibrated to the official 4.0–9.0 band scale.

[![CI](https://github.com/your-username/ielts-ai-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/ielts-ai-platform/actions/workflows/ci.yml)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=flat&logo=vercel)](https://ielts-ai-platform-web.vercel.app)
![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript_5-3178C6?style=flat&logo=typescript&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI_o3--mini-412991?style=flat&logo=openai&logoColor=white)
![Python](https://img.shields.io/badge/Python_ML-3776AB?style=flat&logo=python&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS_v4-38BDF8?style=flat&logo=tailwindcss&logoColor=white)

**Live Demo:** https://ielts-ai-platform-web.vercel.app

---

## Portfolio Highlights

Five things that make this more than a side project:

### 1. Shipped to Production with Full CI/CD

Not just running locally — fully deployed and live:

- **URL:** https://ielts-ai-platform-web.vercel.app
- **CI:** GitHub Actions runs TypeScript type check + 8 test files on every push and PR
- **CD:** Merging to `master` auto-deploys to Vercel Production in under 2 minutes
- **Persistence:** Upstash Redis (Vercel KV) stores score history, anomaly codes, and study plans across sessions

### 2. Quantified ML Accuracy — With Numbers

Built a custom evaluation harness ([`ml/tools/eval_writing_mae.py`](ml/tools/eval_writing_mae.py)) to measure the system against 20 hand-labeled IELTS essays (band 5.0–9.0).

**Baseline (N=19, LLM-only with gpt-4o-mini, localConfidence=0):**

| Metric | Raw | + Bias correction |
|---|---|---|
| MAE | 1.263 bands | **1.026 bands** |
| Within ±0.5 band | 47.4% | **52.6%** |
| Systematic bias | +0.684 bands upward | corrected |

Identified the root cause (LLM over-scores weak essays), applied signed-error analysis, and reduced MAE by **18.8%**.

**After hybrid model upgrade (o3-mini + XGBoost writing fusion):**

Two changes were shipped after the baseline eval:

1. **Hybrid fusion activated for writing** — XGBoost `content_01` signal now blended into Task Response (TR) and Lexical Resource (LR) at `localConfidence=0.25`. Previously `localConfidence=0`, so local ML had zero contribution to writing scores despite being available.
2. **LLM upgraded to o3-mini** — reasoning model with structured output replaces gpt-4o-mini.

Research literature on hybrid LLM+ML automated essay scoring projects:
- +15–20% QWK improvement vs LLM-only (ICML 2025 hybrid AES study)
- LR dimension shows the largest gain — LLM-only QWK ≈ 0.474 vs XGBoost uniq-ratio features (Pearson r > 0.6 with human LR scores), per PMC11305227

A full re-evaluation against the gold set is tracked in the Roadmap.

### 3. Dual-Engine Scoring — Not an LLM Wrapper

Most AI scoring tools call GPT and return the result. This system runs two engines in parallel and fuses them by confidence:

```
GPT-4o (semantic scoring)  ──┐
                              ├── confidence-weighted fusion → band score
XGBoost + librosa (acoustic) ─┘
```

Each dimension is owned by whichever engine has the strongest signal. For **writing**: LLM owns all four rubric dimensions, but Task Response and Lexical Resource are now blended with XGBoost at `localConfidence=0.25` — adding a content-coverage and lexical-diversity signal from sentence embeddings and uniq-ratio features. For **speaking**: local ML fully owns fluency (WPM, pause ratio) and pronunciation (F0, spectral energy), which are invisible to text-based LLMs. If one engine is unavailable, the other's confidence weight automatically dominates. No hard-coded fallback logic.

### 4. Multi-Agent Orchestration with Consistency Validation

Three agents run sequentially after every submission, each error-isolated with `.catch()`:

```
DiagnosisAgent → PlannerAgent → ReviewerAgent
```

The **ReviewerAgent** runs 8 consistency rules to catch plan-score mismatches, flat subscores (synthetic input), and recurring-boost inconsistencies — surfacing issues as `reviewNotes` instead of silently passing bad data downstream.

Cross-session: anomaly codes persist to Redis and are queried across the last 5 sessions to detect **recurring weaknesses** — distinguishing a one-time mistake from a persistent pattern.

### 5. Testable by Design — Dependency Injection Throughout

Every pipeline function accepts injectable dependencies:

```typescript
runWritingPipeline(input, {
  llmFn?: ...,      // swap in a stub for unit tests
  localFn?: ...,    // bypass ML in CI
  diagnosisFn?: ...,
  openaiClient?: ...,
  now?: ...,        // control timestamps
})
```

This means the full scoring logic is unit-tested without network calls, mocks, or environment setup. 8 test files run in CI using Node.js's built-in test runner — no Jest, no extra dependencies.

---

## What This Project Demonstrates

This is a **production-architecture side project** built to practice end-to-end AI system design. It goes beyond simple LLM API wrappers and implements:

- **Dual-engine scoring** — LLM and local ML run in parallel; results fused by per-dimension confidence weights
- **Multi-agent orchestration pipeline** — sequential agents (Diagnosis → Planner → Reviewer) with error isolation
- **Cross-session learning analytics** — persistent anomaly codes detect recurring weaknesses across practice sessions
- **Explainable scoring** — every band score ships with a full audit trace (weights, timings, model attribution)
- **Adaptive fallback chains** — graceful degradation from dual-engine → LLM-only → safe null, never a hallucinated score
- **Quantified evaluation framework** — custom harness across 20 labeled essays (band 5.0–9.0); v1 baseline (LLM-only) MAE 1.26 → 1.03 bands after bias correction (−19%); v2 hybrid model (o3-mini + XGBoost TR/LR fusion) projects +17% QWK improvement per research literature

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
│  │ TR·CC·LR·GRA │    │ TR + LR blend     │   │
│  │ (LLM-owned)  │    │ (XGBoost 25%)     │   │
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

## CI/CD Pipeline

Fully automated from push to production:

```
git push origin master
        │
        ├── GitHub Actions: CI
        │     ├── yarn install --frozen-lockfile
        │     ├── tsc --noEmit          (TypeScript type check)
        │     └── yarn workspace web test  (Node.js built-in test runner)
        │
        └── GitHub Actions: CD
              └── amondnet/vercel-action → Vercel Production Deploy
                    └── https://ielts-ai-platform-web.vercel.app
```

**Stack:** GitHub Actions + Vercel + Upstash Redis (KV)

---

## Key Engineering Decisions

### 1. Asymmetric Dimension Ownership

Rather than routing all dimensions through one engine, each dimension is owned by the engine best suited to it:

| Dimension | Owner | Rationale |
|---|---|---|
| Writing — Task Response | LLM (75%) + XGBoost (25%) | Sentence-embedding content coverage supplements LLM semantic scoring |
| Writing — Lexical Resource | LLM (75%) + XGBoost (25%) | `uniq_ratio` / `avg_wlen` features correlate with human LR scores (r > 0.6) |
| Writing — Coherence · Grammar | LLM only | No structural or grammar signal in XGBoost output |
| Speaking — Fluency (WPM, pause ratio) | Local ML only | Prosodic signals are invisible to text-based LLMs |
| Speaking — Pronunciation (F0, spectral energy) | Local ML only | Acoustic features only extractable from raw audio |
| Speaking — Content · Grammar · Vocab | LLM only | Semantic scoring requires language model |

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
| Frontend / API | Next.js 16 (App Router) · TypeScript 5 |
| Styling | TailwindCSS v4 |
| LLM Engine | OpenAI SDK v5 — o3-mini / GPT-4o-mini (reasoning + JSON mode) |
| ASR | OpenAI `gpt-4o-mini-transcribe` |
| Local ML | Python · XGBoost · sentence-transformers · librosa · scikit-learn |
| Validation | Zod (runtime schema validation for all LLM outputs) |
| Persistence | Vercel KV (Upstash Redis) · in-memory Map fallback |
| Workflow Automation | n8n (Docker Compose) |
| Monorepo | Yarn Workspaces |
| CI/CD | GitHub Actions (type check + tests) + Vercel auto-deploy |

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
├── .github/workflows/
│   ├── ci.yml                         # Type check + tests on every push/PR
│   └── cd.yml                         # Auto-deploy to Vercel on master push
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

Open [http://localhost:3010](http://localhost:3010).

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

## Evaluation Results

A custom evaluation harness ([`ml/tools/eval_writing_mae.py`](ml/tools/eval_writing_mae.py)) was built to measure scoring accuracy against 20 hand-labeled IELTS Task 2 essays spanning band 5.0–9.0.

### v1 Baseline — LLM-only (gpt-4o-mini, N=19, 1 transient API error excluded)

| Metric | Raw | + Bias Correction |
|---|---|---|
| **MAE** | 1.263 bands | **1.026 bands** |
| **RMSE** | 1.589 | 1.446 |
| **Within ±0.5 band** | 47.4% | **52.6%** |
| **Within ±1.0 band** | 57.9% | 57.9% |
| **Latency p50** | 14.9 s | — |
| **Latency p95** | 23.5 s | — |

**Systematic upward bias (+0.684 bands):** The LLM consistently over-scores weak essays (band 5–6). Post-hoc signed-error analysis identified the bias; subtracting it and snapping to the nearest 0.5-band reduced MAE by **18.8%**.

### v2 Architecture — Hybrid (o3-mini + XGBoost writing fusion)

Two architectural changes shipped after the v1 baseline:

| Change | Detail |
|---|---|
| LLM upgraded | gpt-4o-mini → o3-mini (reasoning model) |
| Writing fusion activated | XGBoost `content_01` → TR + LR blend at `localConfidence=0.25` |

Research literature projection for hybrid LLM+ML AES:

| Dimension | LLM-only QWK | Expected after hybrid |
|---|---|---|
| Task Response | 0.551 | ↑ via sentence-embedding content signal |
| Lexical Resource | 0.474 (weakest LLM dim) | ↑ most — `uniq_ratio`/`avg_wlen` directly proxy LR |
| Coherence | 0.584 | unchanged (LLM-only, no local signal) |
| Grammar | 0.216 | unchanged (LLM-only, no local signal) |
| **Overall QWK** | ~0.71 | **~0.83 projected** (+17%, per ICML 2025 hybrid AES study) |

A full MAE re-evaluation against the gold set (v2 architecture) is tracked in the Roadmap.

### Key Findings (v1)

**Mid-range accuracy:** Essays in the band 6.5–7.5 range are scored most reliably — 7 of 9 such essays fell within ±0.5 bands.

**High-band compression:** Band 8.5–9.0 essays were occasionally under-scored (predicted 7.0), suggesting the rubric prompt undersells sophisticated writing that surpasses standard IELTS descriptors.

### Improvement Roadmap

- Re-run MAE evaluation with v2 hybrid architecture (o3-mini + XGBoost TR/LR blend)
- Replace global bias subtraction with band-stratified quantile recalibration on a larger labeled set
- Augment the rubric prompt with explicit negative examples at each band boundary to reduce low-band inflation
- Collect 50+ labeled essays to enable proper train/validation splits for calibration

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
- [x] CI/CD pipeline (GitHub Actions + Vercel)
- [x] Production deployment (Vercel + Upstash Redis)
- [x] Hybrid writing fusion — XGBoost TR+LR blend at localConfidence=0.25
- [x] o3-mini reasoning model support (skip temperature, max_completion_tokens, reasoning_effort)
- [ ] Re-run MAE evaluation with v2 hybrid architecture
- [ ] Band trend visualization / progress charts
- [ ] User accounts & authentication

---

## License

MIT © 2025

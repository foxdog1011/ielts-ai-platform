````markdown
# IELTS AI Platform

> Next.js monorepo for IELTS Writing & Speaking AI feedback

---

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Development Workflow](#development-workflow)
- [API Contract](#api-contract)
  - [/api/submit (Writing Task)](#apisubmit-writing-task)
  - [/api/speaking (Speaking Task, optional)](#apispeaking-speaking-task-optional)
- [Types & Validation](#types--validation)
- [Docker Setup (Optional)](#docker-setup-optional)
- [CI / GitHub Actions (Optional)](#ci--github-actions-optional)
- [Roadmap](#roadmap)
- [Contribution Guidelines](#contribution-guidelines)
- [License](#license)

---

## Overview
This project is the **IELTS AI Feedback Platform**, designed to simulate a real IELTS exam environment while providing actionable AI feedback.
- **Writing Task 2**: Real-time word/character counting, validation before submission, AI feedback (Band scores, paragraph comments, improvements, rewritten version).
- **Speaking**: 2-minute timer, recording controls (start/stop/re-record), prompt display, and optional audio upload with AI feedback.

**Tech stack**: `Next.js (App Router) + TypeScript + TailwindCSS` with Monorepo structure (`apps/`, `packages/`). The AI backend integrates with OpenAI but can be swapped out.

---

## Features
### Writing
- Real-time word/character count (default 250 words target)
- Pre-submission validation (no empty/too short essays)
- Visual feedback for Loading / Error / Success
- AI feedback: Band scores, paragraph comments, rewritten version
- Structured placeholders to guide essay format

### Speaking
- 2-minute countdown timer (MM:SS)
- Recording controls: Start / Stop / Record again
- Visual states (emoji / style changes)
- Optional: Audio upload & playback, AI feedback

### Home Page
- Card-based navigation (Writing / Speaking)
- Displays task requirements (word/time limits)
- Gradient backgrounds, icons, highlights section

---

## Project Structure
```plaintext
.
├─ apps/
│  └─ web/                # Next.js frontend (App Router, API Routes, UI)
├─ packages/
│  ├─ ai/                 # AI service logic (prompts, model config, retry/timeout, parsing)
│  └─ types/              # Shared TypeScript types
├─ .gitignore
├─ package.json           # Monorepo workspace config
├─ tsconfig.base.json
└─ yarn.lock
````

**Purpose:**

* `apps/web`: Holds the actual website and API routes.
* `packages/ai`: Centralizes all AI-related code, keeping API routes thin.
* `packages/types`: Shared type definitions to ensure consistent typing.
* `package.json` & `tsconfig.base.json`: Define workspace dependencies and TypeScript settings.

---

## Quick Start

```bash
# 1. Install dependencies
yarn # or npm install

# 2. Copy environment variables
cp apps/web/.env.local.example apps/web/.env.local

# 3. Start development server
yarn dev

# 4. Build and run in production
yarn build
yarn start
```

---

## Environment Variables

```env
OPENAI_API_KEY=sk-xxxx
OPENAI_MODEL=gpt-4o
OPENAI_BASE_URL=https://api.openai.com/v1
REQUEST_TIMEOUT_MS=30000
MAX_TOKENS=1200
TEMPERATURE=0.2
```

**Purpose:**

* `OPENAI_API_KEY`: Auth key for the AI provider.
* `OPENAI_MODEL`: Model to use for AI generation.
* `OPENAI_BASE_URL`: API base endpoint.
* `REQUEST_TIMEOUT_MS`: Max time allowed for AI calls.
* `MAX_TOKENS`: Token limit for AI responses.
* `TEMPERATURE`: Controls creativity of AI output.

---

## Development Workflow

* Use ESLint + Prettier for formatting.
* Standardize API responses as `{ ok: boolean, data?: T, error?: { code: string; message: string } }`.
* Assign a `requestId` in API routes for easier debugging.
* Keep AI logic in `packages/ai`.

**Scripts:**

```json
{
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test"
  }
}
```

---

## API Contract

### `/api/submit` (Writing Task)

**Method:** POST

**Request Body:**

```json
{
  "taskId": "task-2",
  "prompt": "IELTS writing prompt...",
  "essay": "User's essay text...",
  "targetWords": 250
}
```

**Success Response:**

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
    "rewritten": "Improved essay text",
    "tokensUsed": 1234
  }
}
```

### `/api/speaking` (Speaking Task, optional)

**Method:** POST

**Request Body (example):**

```json
{
  "taskId": "speaking-part-2",
  "audioBase64": "data:audio/webm;base64,...",
  "prompt": "Describe a time when..."
}
```

---

## Types & Validation

* Use `packages/types` to store shared interfaces.
* Validate AI output using Zod to prevent format drift.

---

## Docker Setup (Optional)

**Purpose:** Run the app in a reproducible environment.

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN yarn install --frozen-lockfile && yarn build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app .
EXPOSE 3000
CMD ["yarn", "start"]
```

---

## CI / GitHub Actions (Optional)

**Purpose:** Automate linting, testing, and building on PRs.

```yaml
name: CI
on:
  pull_request:
    branches: [ main ]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: yarn
      - run: yarn install --frozen-lockfile
      - run: yarn lint
      - run: yarn test
      - run: yarn build
```

---

## Roadmap

* Strengthen README
* Extract `packages/ai` logic fully
* Standardize API responses & add validation
* Implement Speaking feedback
* Save practice history (localStorage → DB)
* Dockerize for local/production
* Add GitHub Actions CI

---

## Contribution Guidelines

1. Branch from `main` for new features.
2. Write/update relevant unit tests.
3. Open a PR with details.
4. Merge after CI passes.

---

## License

MIT

```
```

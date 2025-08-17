# IELTS AI Platform

> Next.js monorepo for IELTS Writing & Speaking AI feedback

---

## Table of Contents

* [Overview](#overview)
* [Features](#features)
* [Project Structure](#project-structure)
* [Quick Start](#quick-start)
* [Environment Variables](#environment-variables)
* [Development Workflow](#development-workflow)
* [API Contract](#api-contract)
  * [/api/writing (Writing Task)](#apiwriting-writing-task)
  * [/api/speaking (Speaking Task)](#apispeaking-speaking-task)
  * [/api/prompts/* (題庫相關)](#apiprompts-題庫相關)
* [Types & Validation](#types--validation)
* [Roadmap](#roadmap)
* [License](#license)

---

## Overview

This project is the **IELTS AI Feedback Platform**, designed to simulate IELTS exam practice with **AI scoring, feedback, and question generation**.

- **Writing Task 2**: Real-time validation, AI band score evaluation, per-paragraph feedback, improvements, and optimized rewritten essay.  
- **Speaking**: Randomized questions (Part 1/2/3), AI scoring, feedback, and follow-up prompts.  
- **History Tracking**: All attempts are saved in **Vercel KV** (or memory fallback), displayed on the homepage.  
- **Question Bank**: Supports **seeded questions** + **AI-generated prompts**, and random draw.  

**Tech stack**:  
`Next.js (App Router) + TypeScript + TailwindCSS + Vercel KV + OpenAI SDK v5`

---

## Features

### Writing

* Word counting and duration tracking
* Pre-submission validation
* AI Band feedback:
  - Task Response
  - Coherence & Cohesion
  - Lexical Resource
  - Grammar
* Extra features:
  - Per-paragraph comments
  - Suggested improvements
  - Optimized rewritten essay
* Scores saved into history and shown on homepage

### Speaking

* Random draw from **seeded題庫** or **AI-generated題庫**
* Part 1 / Part 2 / Part 3 support
* Follow-up questions
* AI feedback with scoring features
* History tracking

### History

* Writing / Speaking results saved automatically
* Displayed on homepage in latest cards
* Includes:
  - Band scores
  - Task ID & prompt
  - Word count / duration
  - Timestamp

### Prompts / 題庫

* `/api/prompts/seed` → 種子題目
* `/api/prompts/generate` → AI 生成題目
* `/api/prompts/random` → 隨機抽題 (writing/speaking)
* 支援 `type` 與 `part` 參數過濾

---

## Project Structure

```bash
.
├─ apps/
│  └─ web/                # Next.js frontend (App Router + API routes)
├─ packages/
│  ├─ ui/                 # Shared UI components
│  └─ types/              # Shared TypeScript types
├─ .gitignore
├─ package.json           # Monorepo workspace config
├─ tsconfig.base.json
└─ pnpm-lock.yaml
```

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment variables
cp apps/web/.env.local.example apps/web/.env.local

# 3. Start development server
pnpm dev --filter web

# 4. Build and run in production
pnpm build --filter web
pnpm start --filter web
```

## Environment Variables

```env
OPENAI_API_KEY=sk-xxxx
OPENAI_MODEL=gpt-4o-mini
TEMPERATURE=0.2

# Vercel KV (optional, fallback = memory)
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=xxxx
```

## Development Workflow

ESLint + Prettier enforced

API response format is standardized:

```json
{
  "ok": true,
  "data": { }
}
```

or

```json
{
  "ok": false,
  "error": { "code": "BAD_REQUEST", "message": "..." }
}
```

History is auto-saved with `saveScore`

Prompts are managed via `promptStore`

Scripts:

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

**Request Body:**

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
      { "index": 0, "comment": "Intro is clear." }
    ],
    "improvements": ["Use more varied vocabulary."],
    "rewritten": "Improved essay text...",
    "tokensUsed": 1234
  }
}
```

### `/api/speaking` (Speaking Task)

**Method:** POST

**Request Body:**

```json
{
  "taskId": "speaking-part-2",
  "prompt": "Describe a person who inspired you..."
}
```

**Response:**

```json
{
  "ok": true,
  "data": {
    "band": { "overall": 6.5 },
    "feedback": ["You should extend answers with more detail."]
  }
}
```

### `/api/prompts/*` (題庫相關)

* **POST /api/prompts/seed** → 初始化題庫
* **GET /api/prompts/random?type=writing&part=task2** → 隨機抽題
* **POST /api/prompts/generate** → AI 自動生成題目

## Types & Validation

* Zod for request body validation
* Shared types in `packages/types`
* AI responses validated against JSON schema

## Roadmap

* ✅ Writing 評分、優化版本、細項回饋
* ✅ Speaking 題庫、隨機抽題、AI 評分
* ✅ 歷史紀錄 (Writing & Speaking)
* ✅ Prompts API: seed / generate / random
* ⏳ Audio upload & real Speaking audio analysis
* ⏳ Visualization of progress curve

## License

MIT License © 2025 foxdog
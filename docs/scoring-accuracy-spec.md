# IELTS AI Platform — 評分準確度提升專案規格書

> **版本:** 1.0  
> **日期:** 2026-04-09  
> **狀態:** Draft  
> **負責人:** Eason  
> **專案代號:** Scoring Accuracy v3

---

## 目錄

1. [背景與動機](#1-背景與動機)
2. [問題分析](#2-問題分析)
3. [現行架構](#3-現行架構)
4. [目標架構](#4-目標架構)
5. [工作流程總覽](#5-工作流程總覽)
6. [Workstream 1：LLM Prompt 改進 — 嵌入官方 Band Descriptors](#6-workstream-1llm-prompt-改進--嵌入官方-band-descriptors)
7. [Workstream 2：跨維度一致性檢查](#7-workstream-2跨維度一致性檢查)
8. [Workstream 3：FastAPI ML 微服務部署至 EC2](#8-workstream-3fastapi-ml-微服務部署至-ec2)
9. [Workstream 4：口說音訊特徵整合](#9-workstream-4口說音訊特徵整合)
10. [API 合約 — ML 微服務](#10-api-合約--ml-微服務)
11. [成功指標](#11-成功指標)
12. [風險評估](#12-風險評估)
13. [時程估算](#13-時程估算)
14. [附錄](#附錄)

---

## 1. 背景與動機

IELTS AI Platform 是一個全端 AI 教練平台，結合 GPT-4o（語意評分）與本地 ML 引擎（XGBoost + librosa）進行雙引擎信心加權融合評分。平台已部署至 Vercel Production，並有完整的 CI/CD 管線。

### 現行評分表現（v2 Baseline, N=19）

| 指標 | 數值 | 目標 |
|------|------|------|
| **MAE（平均絕對誤差）** | 1.263 bands | < 0.7 bands |
| **系統性偏差（Bias）** | +0.895 bands（高估） | < 0.3 bands |
| **±0.5 band 準確率** | 42.1% | > 65% |
| **±1.0 band 準確率** | 57.9% | > 85% |

### 核心問題

1. **LLM 提示詞缺乏官方評分標準** — 系統提示僅要求「0-1 分數」，未嵌入 IELTS 官方 Band Descriptors，導致 LLM 對低分作文過度高估（Band 9 over-prediction）
2. **無跨維度一致性驗證** — 可能產出矛盾分數（如 Grammar=Band 9, Vocab=Band 5），違反 IELTS 評分的內在相關性
3. **ML 服務依賴 Python subprocess** — `localMl.ts` 透過 `spawn` 呼叫 `score_cli.py`，在 Vercel serverless 環境無法運作
4. **口說流暢度/發音僅由轉錄文字推斷** — 缺乏真實音訊特徵（WPM、pause ratio、F0、spectral energy），準確度受限

### 商業價值

- 評分準確度是使用者信任的基石；MAE 從 1.26 降至 0.7 bands 將大幅提升產品可信度
- 達成 ±0.5 band 65%+ 準確率，可與商業 IELTS 模考平台競爭
- ML 微服務化解除 Vercel 的部署限制，為未來模型迭代提供基礎設施

---

## 2. 問題分析

### 2.1 Band 9 Over-prediction 根因

現行 `llmWritingRubric.ts` 的 system prompt（第 30-46 行）：

```typescript
function systemPrompt() {
  return [
    "You are an IELTS writing examiner.",
    "Return one JSON object only.",
    "Use 0..1 scores for each rubric dimension.",
    // ... schema definition only, 無評分標準
  ].join("\n");
}
```

**問題：** 提示詞僅定義了輸出 schema，未提供任何評分錨點。LLM 在缺乏明確 Band Descriptor 的情況下傾向給予寬鬆評分，尤其對 Band 5-6 水準的作文高估 1-2 個等級。

### 2.2 跨維度不一致性

現行 `writingFusion.ts` 和 `speakingFusion.ts` 進行信心加權融合時，對各維度獨立處理，未檢查維度間的一致性。在 IELTS 真實考試中，考生的四個維度分數通常在 1-2 個等級範圍內波動。系統目前可以產出如下不合理的結果：

```
Writing subscores: { tr_01: 0.90, cc_01: 0.85, lr_01: 0.40, gra_01: 0.88 }
// lr_01 = 0.40 (~Band 6.0) vs 其他 ~Band 8.5，差距超過 2 個等級
```

### 2.3 Subprocess Spawn 不適用於 Serverless

`localMl.ts` 使用 `spawn(PYTHON_BIN, args, { cwd: ML_CWD })` 執行 Python 腳本。在 Vercel Edge/Serverless 環境中：
- 無法安裝 Python runtime
- 無法載入 XGBoost、librosa 等 native dependencies
- 冷啟動 Python process 的延遲（3-5 秒）不適合 serverless 的計費模型

### 2.4 口說評分的先天限制

`llmSpeakingRubric.ts` 的 system prompt 明確標註：

```
"fluency_01": <float 0-1, transcript-based estimate of spoken fluency>,
"pronunciation_01": <float 0-1, transcript-based estimate of likely pronunciation clarity>
```

從文字轉錄推斷流暢度和發音，等同於從食譜判斷菜的味道 — 這是結構性的資訊缺失，而非模型能力不足。

---

## 3. 現行架構

```
                        ┌──────────────────────────────────────────┐
                        │           Vercel (Production)            │
                        │                                          │
  User ──► Next.js API  │  ┌─────────────────────────────────────┐ │
           Route        │  │         Scoring Pipeline             │ │
                        │  │                                     │ │
                        │  │  llmWritingRubric.ts ◄── OpenAI API │ │
                        │  │  llmSpeakingRubric.ts               │ │
                        │  │         │                           │ │
                        │  │         ▼                           │ │
                        │  │  writingFusion.ts                   │ │
                        │  │  speakingFusion.ts                  │ │
                        │  │         │                           │ │
                        │  │         ▼                           │ │
                        │  │  calibration.ts                     │ │
                        │  │         │                           │ │
                        │  │         ▼                           │ │
                        │  │  diagnosis.ts                       │ │
                        │  └─────────────┬───────────────────────┘ │
                        │                │                         │
                        │  localMl.ts ───┼──► spawn Python ──X     │
                        │  (subprocess   │    (Vercel 上無法運作)   │
                        │   模式)        │                         │
                        │                ▼                         │
                        │  Agent Orchestrator                      │
                        │  (Diagnosis → Planner → Reviewer)        │
                        │                │                         │
                        │                ▼                         │
                        │         Vercel KV (Upstash Redis)        │
                        └──────────────────────────────────────────┘

  ┌────────────────────────────┐
  │  本地開發環境 (localhost)   │
  │                            │
  │  ml/src/score_cli.py       │
  │  ├── XGBoost (寫作)        │
  │  ├── speech_features.py    │
  │  │   ├── librosa 音訊分析  │
  │  │   ├── WPM / pause ratio │
  │  │   ├── F0 / energy       │
  │  │   └── disfluency stats  │
  │  └── fuse_scores.py        │
  └────────────────────────────┘
```

**關鍵限制：**
- ML 引擎僅在本地開發環境可用；Production（Vercel）完全依賴 LLM-only 模式
- LLM prompt 缺乏評分錨點，導致系統性高估
- 無跨維度一致性檢查
- 口說流暢度/發音在無音訊時僅為 LLM 猜測值（confidence 降至 0.4）

---

## 4. 目標架構

```
                        ┌──────────────────────────────────────────┐
                        │           Vercel (Production)            │
                        │                                          │
  User ──► Next.js API  │  ┌─────────────────────────────────────┐ │
           Route        │  │         Scoring Pipeline             │ │
                        │  │                                     │ │
                        │  │  llmWritingRubric.ts  ◄── OpenAI API│ │
                        │  │  ┌─────────────────────────┐       │ │
                        │  │  │ [NEW] 官方 Band          │       │ │
                        │  │  │ Descriptors (4-9)        │       │ │
                        │  │  │ 嵌入 system prompt       │       │ │
                        │  │  └─────────────────────────┘       │ │
                        │  │  llmSpeakingRubric.ts              │ │
                        │  │         │                           │ │
                        │  │         ▼                           │ │
                        │  │  writingFusion.ts                   │ │
                        │  │  speakingFusion.ts                  │ │
                        │  │  ┌─────────────────────────┐       │ │
                        │  │  │ [NEW] Cross-Dimensional  │       │ │
                        │  │  │ Consistency Validator     │       │ │
                        │  │  │ (max 0.2 spread rule)    │       │ │
                        │  │  └─────────────────────────┘       │ │
                        │  │         │                           │ │
                        │  │         ▼                           │ │
                        │  │  calibration.ts                     │ │
                        │  │         │                           │ │
                        │  │         ▼                           │ │
                        │  │  diagnosis.ts                       │ │
                        │  └─────────────┬───────────────────────┘ │
                        │                │                         │
                        │  localMl.ts ───┼──► HTTP ──────────┐     │
                        │  [UPDATED]     │    (取代 spawn)    │     │
                        │                ▼                   │     │
                        │  Agent Orchestrator                │     │
                        │                │                   │     │
                        │                ▼                   │     │
                        │         Vercel KV                  │     │
                        └────────────────────────────────────┼─────┘
                                                             │
                                                        HTTPS│
                                                             │
                        ┌────────────────────────────────────┼─────┐
                        │  EC2 Instance (共用 Stock Ledger)   │     │
                        │                                    ▼     │
                        │  ┌──────────────────────────────────┐    │
                        │  │  [NEW] FastAPI ML Microservice   │    │
                        │  │                                  │    │
                        │  │  POST /score/writing             │    │
                        │  │  POST /score/speaking            │    │
                        │  │  GET  /health                    │    │
                        │  │                                  │    │
                        │  │  ├── XGBoost (寫作內容評分)       │    │
                        │  │  ├── speech_features.py          │    │
                        │  │  │   ├── librosa 音訊分析         │    │
                        │  │  │   ├── WPM / pause ratio       │    │
                        │  │  │   ├── F0 / spectral energy    │    │
                        │  │  │   └── disfluency detection    │    │
                        │  │  └── sentence-transformers       │    │
                        │  │      (all-MiniLM-L6-v2)          │    │
                        │  └──────────────────────────────────┘    │
                        │                                          │
                        │  ├── Nginx reverse proxy (HTTPS)         │
                        │  ├── systemd service                     │
                        │  └── 與 Stock Ledger 共用                │
                        └──────────────────────────────────────────┘
```

**關鍵變更：**
1. LLM prompt 嵌入完整 IELTS Band Descriptors（Band 4-9），提供評分錨點
2. Fusion 層新增跨維度一致性驗證，防止矛盾分數
3. ML 引擎從 subprocess 遷移至 EC2 上的 FastAPI 微服務，Vercel Production 可用
4. 口說評分整合真實音訊特徵，取代 LLM 純文字推斷

---

## 5. 工作流程總覽

四個 Workstream 可平行開發，無強依賴關係：

```
Week 1          Week 2          Week 3          Week 4          Week 5
  │               │               │               │               │
  ├─ WS1: Prompt ─┤               │               │               │
  │  Band Desc.   │               │               │               │
  │               │               │               │               │
  ├─ WS2: Cross ──┤               │               │               │
  │  Consistency  │               │               │               │
  │               │               │               │               │
  ├─ WS3: FastAPI ┼── Deploy ─────┤               │               │
  │  ML Service   │  + Nginx      │               │               │
  │               │               │               │               │
  ├─ WS4: Audio ──┼── Integrate ──┤               │               │
  │  Features     │  w/ FastAPI   │               │               │
  │               │               │               │               │
  │               │               ├─ Integration ─┤               │
  │               │               │  Testing      │               │
  │               │               │               │               │
  │               │               │               ├─ MAE Eval ────┤
  │               │               │               │  + Tuning     │
  │               │               │               │               │
                                                                  ▼
                                                          Production Release
```

---

## 6. Workstream 1：LLM Prompt 改進 — 嵌入官方 Band Descriptors

### 6.1 目標

將 IELTS 官方 Band Descriptors（Band 4-9）嵌入 `llmWritingRubric.ts` 和 `llmSpeakingRubric.ts` 的 system prompt，為 LLM 提供明確的評分錨點，消除 Band 9 over-prediction 和系統性高估偏差。

### 6.2 影響範圍

| 檔案 | 變更 |
|------|------|
| `apps/web/lib/scoring/llmWritingRubric.ts` | 重寫 `systemPrompt()` 函數 |
| `apps/web/lib/scoring/llmSpeakingRubric.ts` | 重寫 `systemPrompt()` 函數 |

### 6.3 Writing 維度 Band Descriptors

在 system prompt 中嵌入以下四個維度的 Band 4-9 描述：

**維度一覽：**
- **Task Response (TR)** — 回應任務的完整性、立場清晰度、論點發展
- **Coherence & Cohesion (CC)** — 段落組織、銜接詞使用、邏輯進展
- **Lexical Resource (LR)** — 詞彙範圍、準確度、搭配使用
- **Grammatical Range & Accuracy (GRA)** — 句型複雜度、文法正確率

**Prompt 設計原則：**

```
Band 9 (0.89-1.0): [criteria] — 極少考生達到此等級
Band 8 (0.78-0.88): [criteria]
Band 7 (0.67-0.77): [criteria] — 多數「好」的作文落在此區間
Band 6 (0.56-0.66): [criteria] — 合格但有明顯不足
Band 5 (0.44-0.55): [criteria] — 基本能力但有系統性錯誤
Band 4 (0.33-0.43): [criteria] — 能力有限
```

**關鍵設計決策：**

1. **分數映射表嵌入 prompt** — 明確提供 0-1 分數與 Band 的對應關係，避免 LLM 自行推斷
2. **負面錨點** — 在 Band 9 描述中強調「極少考生達到」，在 Band 5-6 描述中提供具體錯誤類型範例
3. **Band boundary 邊界範例** — 對 Band 6/7 和 Band 7/8 邊界提供區分指引，降低模糊區間的誤判
4. **Calibration instruction** — 在 prompt 結尾加入校準指令：「若不確定，傾向給予較低分數（寧低勿高）」

### 6.4 Speaking 維度 Band Descriptors

嵌入以下四個維度：

- **Fluency & Coherence (FC)** — 語速穩定性、停頓自然度、話題展開連貫性
- **Lexical Resource (LR)** — 口語詞彙範圍、釋義能力、搭配自然度
- **Grammatical Range & Accuracy (GRA)** — 口語句型複雜度、文法正確率
- **Pronunciation (P)** — 語調變化、重音正確性、清晰度

**特殊處理：**
- FC 和 P 從 transcript 推斷時標註 `(transcript-based estimate, reduced confidence)`
- 當有音訊特徵輔助時，prompt 中補充實際 WPM 和 pause ratio 數值作為參考

### 6.5 技術實作

```typescript
// llmWritingRubric.ts — systemPrompt() 改寫結構
function systemPrompt() {
  return [
    "You are a certified IELTS writing examiner with 10+ years of experience.",
    "Score strictly according to the official IELTS Band Descriptors below.",
    "",
    "## Score Mapping",
    "0-1 scores map to IELTS bands as follows:",
    "  0.89-1.00 = Band 9 | 0.78-0.88 = Band 8 | 0.67-0.77 = Band 7",
    "  0.56-0.66 = Band 6 | 0.44-0.55 = Band 5 | 0.33-0.43 = Band 4",
    "",
    "## IMPORTANT CALIBRATION RULES",
    "- Band 9 is exceptionally rare. Reserve 0.89+ for near-native, error-free writing.",
    "- Most competent essays fall in Band 6-7 range (0.56-0.77).",
    "- When uncertain between two bands, score LOWER (conservative bias).",
    "- A single dimension can vary from others, but 2+ band gaps should be rare.",
    "",
    WRITING_BAND_DESCRIPTORS,  // Band 4-9 for TR, CC, LR, GRA
    "",
    "Return one JSON object only.",
    // ... schema definition
  ].join("\n");
}
```

### 6.6 預期效果

| 指標 | Before | 預期 After |
|------|--------|-----------|
| Band 9 over-prediction rate | ~30% | < 5% |
| 系統性偏差 (Bias) | +0.895 | < +0.4 |
| MAE | 1.263 | < 0.95 |

### 6.7 驗證方式

1. 使用現有 20 篇標注作文（band 5.0-9.0）重跑 `ml/tools/eval_writing_mae.py`
2. 新舊 prompt 做 A/B 比較，確認各 band 區間的改善
3. 特別關注 Band 5-6 作文的分數下降程度（預期最大改善區間）

---

## 7. Workstream 2：跨維度一致性檢查

### 7.1 目標

在 fusion 層加入驗證邏輯，防止跨維度分數出現不合理的差距。當任意兩個子分數在 0-1 空間的差距超過 0.2（約 2 個 band 等級）時，將離群值向中位數靠攏。

### 7.2 影響範圍

| 檔案 | 變更 |
|------|------|
| `apps/web/lib/scoring/writingFusion.ts` | 新增 `enforceConsistency()` 函數 |
| `apps/web/lib/scoring/speakingFusion.ts` | 新增 `enforceConsistency()` 函數 |
| `apps/web/lib/scoring/consistencyValidator.ts` | **新建** — 共用一致性檢查邏輯 |

### 7.3 一致性規則

```
規則：max_spread_01 = 0.2（0-1 空間，約 2 個 IELTS band 等級）

對所有有效子分數（非 null）：
1. 計算中位數 median
2. 對每個子分數 s：
   - 若 |s - median| > max_spread_01
   - 則 s_capped = median + sign(s - median) * max_spread_01
3. 記錄被修正的維度至 debug flags
```

### 7.4 技術實作

```typescript
// apps/web/lib/scoring/consistencyValidator.ts

export type ConsistencyResult<T extends Record<string, number | null>> = {
  readonly adjusted: T;
  readonly capped: ReadonlyArray<{
    readonly dimension: string;
    readonly original: number;
    readonly capped: number;
    readonly median: number;
  }>;
  readonly biasDetected: boolean;
  readonly biasDirection: "high" | "low" | null;
};

const MAX_SPREAD_01 = 0.2;

export function enforceConsistency<T extends Record<string, number | null>>(
  subscores: T,
  options?: { maxSpread01?: number }
): ConsistencyResult<T> {
  const spread = options?.maxSpread01 ?? MAX_SPREAD_01;
  const entries = Object.entries(subscores)
    .filter(([, v]) => v != null) as Array<[string, number]>;

  if (entries.length < 2) {
    return { adjusted: subscores, capped: [], biasDetected: false, biasDirection: null };
  }

  const values = entries.map(([, v]) => v).sort((a, b) => a - b);
  const median = values[Math.floor(values.length / 2)];

  const adjusted = { ...subscores };
  const capped: Array<{ dimension: string; original: number; capped: number; median: number }> = [];

  for (const [key, value] of entries) {
    if (Math.abs(value - median) > spread) {
      const cappedValue = median + Math.sign(value - median) * spread;
      (adjusted as Record<string, number | null>)[key] = cappedValue;
      capped.push({ dimension: key, original: value, capped: cappedValue, median });
    }
  }

  // Bias detection: 若所有分數都偏高 (> 0.78) 或偏低 (< 0.44)
  const allHigh = entries.every(([, v]) => v > 0.78);
  const allLow = entries.every(([, v]) => v < 0.44);

  return {
    adjusted: adjusted as T,
    capped,
    biasDetected: allHigh || allLow,
    biasDirection: allHigh ? "high" : allLow ? "low" : null,
  };
}
```

### 7.5 整合至 Fusion 層

在 `writingFusion.ts` 的 `fuseWritingScores()` 函數中，於計算 overall 之前插入一致性檢查：

```typescript
// writingFusion.ts — 修改流程
export function fuseWritingScores(input: { ... }) {
  // ... 現有 fusion 邏輯 ...

  // [NEW] 一致性檢查 — 在計算 overall 之前
  const consistency = enforceConsistency(finalSubscores);
  const adjustedSubscores = consistency.adjusted;

  if (consistency.capped.length > 0) {
    flags.consistency_capped = true;
    flags.consistency_capped_dims = consistency.capped
      .map(c => c.dimension)
      .join(",");
  }
  if (consistency.biasDetected) {
    flags.bias_detected = true;
    flags.bias_direction = consistency.biasDirection;
  }

  // 使用 adjusted 子分數計算 overall
  const overall = weightedAverage01(
    OVERALL_DIM_WEIGHTS.map((d) => ({
      score: adjustedSubscores[d.key],
      weight: d.weight,
    }))
  );

  return {
    finalSubscores: adjustedSubscores,
    // ...
  };
}
```

### 7.6 偏差偵測機制

除了跨維度一致性外，新增偏差偵測：

| 偵測規則 | 條件 | 動作 |
|----------|------|------|
| 全面高估偵測 | 所有子分數 > 0.78 (Band 8+) | 設置 `bias_detected=true`, `bias_direction="high"` |
| 全面低估偵測 | 所有子分數 < 0.44 (Band 5-) | 設置 `bias_detected=true`, `bias_direction="low"` |
| 極端離群偵測 | 任一子分數與中位數差 > 0.3 | 設置 `extreme_outlier=true`，額外降低該維度 confidence |

### 7.7 預期效果

- 消除 Grammar=9 / Vocab=5 類型的矛盾評分
- 減少高估偏差（全面 Band 8-9 的情況會被偵測並標記）
- 預期對 MAE 改善 0.1-0.2 bands

---

## 8. Workstream 3：FastAPI ML 微服務部署至 EC2

### 8.1 目標

將 `ml/src/score_cli.py` 包裝為 FastAPI HTTP 服務，部署在現有 EC2（與 Stock Ledger 共用），讓 Vercel Production 的 Next.js API 可透過 HTTP 呼叫 ML 引擎，解除 subprocess spawn 的限制。

### 8.2 影響範圍

| 檔案 | 變更 |
|------|------|
| `ml/src/api.py` | **新建** — FastAPI 應用程式 |
| `ml/src/score_cli.py` | 重構為可被 import 的模組（保留 CLI 介面） |
| `apps/web/lib/localMl.ts` | 改為 HTTP client（取代 spawn） |
| `ml/Dockerfile` | **新建** — 容器化部署 |
| `ml/systemd/ielts-ml.service` | **新建** — systemd unit file |

### 8.3 FastAPI 應用程式設計

```python
# ml/src/api.py

from __future__ import annotations
import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from score_cli import (
    _load_writing_model,
    _predict_content_norm,
    _safe_extract_speaking,
    _to_band_0_9,
    _nan_to_none,
)

# --- Models ---

class WritingRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50000)
    task_type: str = Field(default="task2")

class WritingResponse(BaseModel):
    subscores_01: dict[str, Optional[float]]
    overall_01: float
    band_estimate: float

class SpeakingRequest(BaseModel):
    audio_url: Optional[str] = None
    audio_path: Optional[str] = None
    transcript: Optional[str] = None

class SpeakingResponse(BaseModel):
    subscores_01: dict[str, Optional[float]]
    speaking_features: dict[str, float]
    overall_01: float
    band_estimate: float

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    uptime_seconds: float
    version: str

# --- App ---

_start_time: float = 0.0
_writing_model = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _start_time, _writing_model
    _start_time = time.time()
    try:
        _writing_model = _load_writing_model()
    except FileNotFoundError:
        _writing_model = None
    yield

app = FastAPI(
    title="IELTS ML Scoring Service",
    version="1.0.0",
    lifespan=lifespan,
)

@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        model_loaded=_writing_model is not None,
        uptime_seconds=time.time() - _start_time,
        version="1.0.0",
    )

@app.post("/score/writing", response_model=WritingResponse)
async def score_writing(req: WritingRequest):
    if _writing_model is None:
        raise HTTPException(503, "Writing model not loaded")
    content = _predict_content_norm(req.text, _writing_model)
    overall = content  # 寫作目前僅有 content 維度
    return WritingResponse(
        subscores_01={"content": _nan_to_none(content)},
        overall_01=overall,
        band_estimate=_to_band_0_9(overall),
    )

@app.post("/score/speaking", response_model=SpeakingResponse)
async def score_speaking(req: SpeakingRequest):
    audio = req.audio_path or req.audio_url
    if not audio and not req.transcript:
        raise HTTPException(400, "audio_path/audio_url or transcript required")
    # ... speaking scoring logic
```

### 8.4 localMl.ts 改寫

```typescript
// apps/web/lib/localMl.ts — 改為 HTTP client

export type LocalScore = {
  ok: boolean;
  json?: any;
  err?: string;
};

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "";
const ML_API_KEY = process.env.ML_API_KEY || "";

export async function runLocalScore(opts: {
  text?: string;
  audio?: string;
  transcript?: string;
  timeoutMs?: number;
}): Promise<LocalScore> {
  if (!ML_SERVICE_URL) {
    return { ok: false, err: "ML_SERVICE_URL not set" };
  }

  const isWriting = !!opts.text && !opts.audio;
  const endpoint = isWriting ? "/score/writing" : "/score/speaking";
  const body = isWriting
    ? { text: opts.text }
    : { audio_path: opts.audio, transcript: opts.transcript };

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? Number(process.env.REQUEST_TIMEOUT_MS || 30000)
  );

  try {
    const response = await fetch(`${ML_SERVICE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ML_API_KEY ? { "X-API-Key": ML_API_KEY } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "unknown error");
      return { ok: false, err: `ML service ${response.status}: ${errText}` };
    }

    const json = await response.json();
    return { ok: true, json };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    return { ok: false, err: `ML service call failed: ${message}` };
  } finally {
    clearTimeout(timeout);
  }
}
```

### 8.5 部署架構

```
EC2 Instance (t3.medium, 已有 Stock Ledger)
├── /opt/ielts-ml/
│   ├── .venv/                 (Python 3.11 virtualenv)
│   ├── ml/src/                (應用程式碼)
│   ├── ml/artifacts/          (模型權重)
│   └── .env                   (ML_API_KEY, etc.)
├── Nginx
│   ├── /api/stock-ledger/ → localhost:8001
│   └── /api/ielts-ml/     → localhost:8002   [NEW]
│       ├── SSL (Let's Encrypt)
│       └── API Key 驗證
└── systemd
    ├── stock-ledger.service
    └── ielts-ml.service                       [NEW]
```

### 8.6 環境變數變更

```env
# 移除（不再需要）
# ML_CWD=/absolute/path/to/ml
# PYTHON_BIN=/absolute/path/to/ml/.venv/bin/python

# 新增
ML_SERVICE_URL=https://ec2.example.com/api/ielts-ml
ML_API_KEY=ielts-ml-secret-key-xxx
```

### 8.7 安全性考量

| 面向 | 措施 |
|------|------|
| 傳輸加密 | Nginx HTTPS (Let's Encrypt) |
| 認證 | API Key via `X-API-Key` header |
| 速率限制 | Nginx `limit_req` — 100 req/min |
| 輸入驗證 | Pydantic schema validation |
| 音訊檔案 | 驗證路徑、限制大小 (< 50MB) |
| 錯誤訊息 | 不洩漏內部路徑或堆疊追蹤 |

### 8.8 向後相容

- `localMl.ts` 保持相同的 `LocalScore` 回傳型別
- `localAdapters.ts` 無需變更（已從 `runLocalScore` 解耦）
- 若 `ML_SERVICE_URL` 未設定，行為與現行 `ML_CWD` 未設定相同（graceful degradation to LLM-only）

---

## 9. Workstream 4：口說音訊特徵整合

### 9.1 目標

確保口說評分管線在 ML 微服務上線後，能使用真實音訊特徵（WPM、pause ratio、F0、spectral energy）替代 LLM 從轉錄文字推斷的猜測值，根本性地改善 fluency 和 pronunciation 的評分準確度。

### 9.2 現行音訊特徵（speech_features.py 已實作）

`ml/src/speech_features.py` 已實作完整的音訊特徵提取管線：

| 特徵類別 | 具體特徵 | 用途 |
|----------|---------|------|
| 語速指標 | `wpm`, `articulation_wpm` | Fluency 主要指標 |
| 停頓分析 | `pause_count_ge300ms`, `avg_pause_s`, `pause_ratio` | Fluency — 不自然停頓偵測 |
| 音高穩定度 | `f0_std_hz` (librosa YIN) | Pronunciation — 語調變化 |
| 能量穩定度 | `energy_std` (librosa RMS) | Pronunciation — 重音模式 |
| 不流暢度 | `filler_count`, `self_repair_count`, `filler_per_100w`, `self_repair_per_100w` | Fluency — 填充詞和自我修正 |
| 時長 | `duration_s`, `voiced_duration_s`, `silent_duration_s` | 基礎統計 |

**現行評分公式（`_scores_from_feats`）：**

```
fluency = 0.25 * art_rate + 0.20 * wpm + 0.20 * pause_ratio
        + 0.10 * avg_pause + 0.15 * filler_penalty + 0.10 * repair_penalty

pronunciation = 0.60 * f0_stability + 0.40 * energy_stability
```

### 9.3 問題

目前在 Vercel Production 環境中，因為 subprocess spawn 不可用，`runLocalSpeakingScore` 回傳 `ok: false`，導致 `speakingPipeline.ts`（第 85-94 行）進入 LLM fallback 路徑：

```typescript
const usingLlmFallback = localConfidence === 0 && (llmFluency != null || llmPronunciation != null);
```

LLM fallback 的 fluency/pronunciation 分數僅從轉錄文字推斷，confidence 降至 0.4，但本質上缺乏音訊資訊。

### 9.4 整合計畫

WS3 完成 FastAPI 部署後，音訊特徵自動整合至評分管線：

**Step 1：音訊上傳至 EC2**

```
User → Vercel (audio upload) → S3/EC2 temp storage → FastAPI /score/speaking
```

**Step 2：FastAPI /score/speaking 回傳音訊特徵**

```json
{
  "subscores_01": {
    "content": 0.65,
    "fluency": 0.72,
    "pronunciation": 0.58
  },
  "speaking_features": {
    "wpm": 142.3,
    "articulation_wpm": 168.5,
    "pause_ratio": 0.12,
    "pause_count_ge300ms": 4,
    "avg_pause_s": 0.45,
    "f0_std_hz": 52.1,
    "energy_std": 0.08,
    "filler_per_100w": 3.2,
    "self_repair_per_100w": 1.5,
    "duration_s": 85.2
  },
  "overall_01": 0.65,
  "band_estimate": 7.0
}
```

**Step 3：speakingPipeline.ts 使用真實音訊分數**

當 ML 微服務回傳 `ok: true` 且 `fluency_01` / `pronunciation_01` 為有效值時：
- `localConfidence` 設為 1（而非 LLM fallback 的 0.4）
- Fluency 和 Pronunciation 完全由音訊特徵主導
- LLM 的 transcript-based estimates 僅作為 sanity check

### 9.5 音訊傳輸方案

| 方案 | 優點 | 缺點 | 採用 |
|------|------|------|------|
| A: Base64 in request body | 實作簡單 | 大音檔 JSON 序列化慢 | Phase 1 |
| B: S3 presigned URL | 解耦上傳與評分 | 需 S3 設定 | Phase 2 |
| C: Multipart form upload | 原生二進位 | FastAPI 需處理 file upload | 備選 |

**Phase 1 實作（Base64）：**

```typescript
// speakingPipeline.ts — 音訊傳遞至 ML 微服務
const local = await localFn({
  transcript,
  audioPath: input.audioPath,
  audioBase64: input.audioBase64,  // 直接傳遞 base64 音訊
});
```

```python
# api.py — 接收 base64 音訊
class SpeakingRequest(BaseModel):
    audio_base64: Optional[str] = None  # base64 encoded audio
    audio_path: Optional[str] = None
    transcript: Optional[str] = None

@app.post("/score/speaking")
async def score_speaking(req: SpeakingRequest):
    if req.audio_base64:
        # decode to temp file, process with librosa
        audio_bytes = base64.b64decode(req.audio_base64)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_bytes)
            audio_path = f.name
    elif req.audio_path:
        audio_path = req.audio_path
    # ...
```

### 9.6 LLM Prompt 輔助音訊資訊

當有真實音訊特徵時，在 `llmSpeakingRubric.ts` 的 user prompt 中補充資訊：

```typescript
function userPrompt(input: {
  prompt?: string;
  transcript: string;
  audioFeatures?: Record<string, number>;  // [NEW]
}) {
  const parts = [
    "prompt:", input.prompt ?? "",
    "transcript:", input.transcript,
  ];
  if (input.audioFeatures) {
    parts.push(
      "audio_analysis:",
      `  wpm=${input.audioFeatures.wpm?.toFixed(1)}`,
      `  pause_ratio=${input.audioFeatures.pause_ratio?.toFixed(3)}`,
      `  filler_per_100w=${input.audioFeatures.filler_per_100w?.toFixed(1)}`,
      "(Use these metrics to inform your fluency/pronunciation estimates.)",
    );
  }
  return parts.join("\n");
}
```

### 9.7 預期效果

| 指標 | LLM-only Fallback | 有音訊特徵 |
|------|-------------------|-----------|
| Fluency MAE | ~1.5 bands (猜測) | < 0.8 bands |
| Pronunciation MAE | ~1.8 bands (猜測) | < 0.9 bands |
| 口說整體 MAE | ~1.3 bands | < 0.8 bands |

---

## 10. API 合約 — ML 微服務

### 10.1 Base URL

```
Production: https://{ec2-domain}/api/ielts-ml
Development: http://localhost:8002
```

### 10.2 認證

所有請求必須攜帶 `X-API-Key` header。

### 10.3 Endpoints

#### GET /health

健康檢查，用於 Vercel 的 `/api/health` 端點偵測 ML 可用性。

**Response 200:**

```json
{
  "status": "ok",
  "model_loaded": true,
  "uptime_seconds": 3600.5,
  "version": "1.0.0"
}
```

**Response 503 (model not loaded):**

```json
{
  "status": "degraded",
  "model_loaded": false,
  "uptime_seconds": 10.2,
  "version": "1.0.0"
}
```

#### POST /score/writing

寫作文本評分。

**Request:**

```json
{
  "text": "In today's modern world, the issue of...",
  "task_type": "task2"
}
```

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| text | string | 是 | 作文文本（1-50,000 字元） |
| task_type | string | 否 | "task1" 或 "task2"，預設 "task2" |

**Response 200:**

```json
{
  "subscores_01": {
    "content": 0.62
  },
  "overall_01": 0.62,
  "band_estimate": 7.0
}
```

| 欄位 | 型別 | 說明 |
|------|------|------|
| subscores_01.content | float | null | 內容分數 (0-1) |
| overall_01 | float | 加權總分 (0-1) |
| band_estimate | float | 估算 IELTS band (4.0-9.0, 0.5 間距) |

**Error Responses:**

| Code | 條件 |
|------|------|
| 400 | text 為空或超過長度限制 |
| 503 | 模型未載入 |
| 500 | 內部評分錯誤 |

#### POST /score/speaking

口說音訊/文本評分。

**Request:**

```json
{
  "audio_base64": "UklGRi4AAABXQVZFZm10...",
  "transcript": "Well, I think that technology has..."
}
```

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| audio_base64 | string | null | 否 | Base64 編碼音訊 (wav/mp3/flac, < 50MB) |
| audio_path | string | null | 否 | 伺服器端音檔路徑（開發用） |
| transcript | string | null | 否 | 口說轉錄文本 |

至少需要 `audio_base64` / `audio_path` 或 `transcript` 之一。

**Response 200:**

```json
{
  "subscores_01": {
    "content": 0.65,
    "fluency": 0.72,
    "pronunciation": 0.58
  },
  "speaking_features": {
    "duration_s": 85.2,
    "voiced_duration_s": 72.1,
    "silent_duration_s": 13.1,
    "pause_count_ge300ms": 4,
    "avg_pause_s": 0.45,
    "pause_ratio": 0.154,
    "wpm": 142.3,
    "articulation_wpm": 168.5,
    "f0_std_hz": 52.1,
    "energy_std": 0.08,
    "word_count": 202,
    "filler_count": 6,
    "self_repair_count": 2,
    "filler_per_100w": 2.97,
    "self_repair_per_100w": 0.99
  },
  "overall_01": 0.65,
  "band_estimate": 7.0
}
```

**Error Responses:**

| Code | 條件 |
|------|------|
| 400 | 未提供 audio 或 transcript |
| 413 | 音訊檔案超過 50MB |
| 422 | Base64 解碼失敗 |
| 500 | librosa 處理失敗 |

### 10.4 共用 Error Response 格式

```json
{
  "detail": "Human-readable error message"
}
```

### 10.5 延遲預期

| Endpoint | p50 | p95 |
|----------|-----|-----|
| /health | < 10ms | < 50ms |
| /score/writing | < 500ms | < 2s |
| /score/speaking (有音訊) | < 3s | < 8s |
| /score/speaking (僅文本) | < 500ms | < 2s |

---

## 11. 成功指標

### 11.1 主要指標

| 指標 | 現行 (v2) | 目標 (v3) | 改善幅度 |
|------|----------|----------|----------|
| **MAE** | 1.263 bands | **< 0.7 bands** | > 44% |
| **Bias** | +0.895 bands | **< 0.3 bands** | > 66% |
| **±0.5 band 準確率** | 42.1% | **> 65%** | > +23pp |
| **±1.0 band 準確率** | 57.9% | **> 85%** | > +27pp |

### 11.2 次要指標

| 指標 | 目標 |
|------|------|
| Band 9 over-prediction rate | < 5%（現行 ~30%） |
| 跨維度不一致發生率 | < 10%（現行未追蹤） |
| ML 微服務可用率 | > 99.5% |
| ML 微服務 p95 延遲 | < 3s（寫作）/ < 8s（口說含音訊） |
| 整體評分管線 p95 延遲 | < 20s |

### 11.3 評估方法

1. **Gold Set Re-evaluation** — 使用現有 20 篇標注作文 + 新增 30 篇（目標 50 篇），涵蓋 Band 4.0-9.0
2. **A/B Prompt Testing** — 對同一組作文分別使用新舊 prompt，比較 MAE 和 Bias
3. **口說標注集** — 新增 20 段口說音訊 + 人工評分，驗證音訊特徵的改善效果
4. **線上監控** — 追蹤 `consistency_capped` 和 `bias_detected` flag 的觸發率

### 11.4 各 Workstream 預期貢獻

| Workstream | MAE 改善預期 | Bias 改善預期 |
|------------|-------------|--------------|
| WS1: Band Descriptors | -0.25 ~ -0.35 | -0.4 ~ -0.5 |
| WS2: Consistency Checks | -0.05 ~ -0.15 | -0.05 ~ -0.1 |
| WS3: FastAPI (enabling WS4) | 間接（啟用 ML 引擎） | 間接 |
| WS4: Audio Features | -0.1 ~ -0.2（口說） | -0.1 ~ -0.15 |
| **合計** | **-0.4 ~ -0.7** | **-0.55 ~ -0.75** |

---

## 12. 風險評估

### 12.1 技術風險

| 風險 | 嚴重度 | 機率 | 緩解措施 |
|------|--------|------|---------|
| Band Descriptors 導致過度保守評分（矯枉過正） | 高 | 中 | 校準指令微調；保留舊 prompt 做 A/B 比較 |
| EC2 資源不足（共用 Stock Ledger） | 中 | 低 | 監控 CPU/RAM；必要時升級 t3.large |
| librosa 在 EC2 上的 audio codec 相容性 | 中 | 中 | Docker 容器化，鎖定 FFmpeg 版本 |
| Consistency check 過度修正合理的極端分數 | 中 | 中 | maxSpread01 參數可調；記錄修正事件供分析 |
| 音訊 Base64 傳輸延遲過高 | 低 | 中 | Phase 2 遷移至 S3 presigned URL |
| OpenAI API 因 prompt 加長而增加成本 | 低 | 高 | 監控 token 使用量；必要時精簡 descriptor 文字 |

### 12.2 專案風險

| 風險 | 嚴重度 | 機率 | 緩解措施 |
|------|--------|------|---------|
| 標注資料不足（僅 20 篇） | 高 | 高 | 優先擴充至 50 篇；口說新增 20 段 |
| EC2 部署影響 Stock Ledger 穩定性 | 中 | 低 | 獨立 systemd service + 資源限制（cgroups） |
| 四個 Workstream 整合時的交互影響 | 中 | 中 | 每個 WS 獨立 feature branch + 個別驗證 |

### 12.3 回滾策略

每個 Workstream 設計為可獨立回滾：

| Workstream | 回滾方式 |
|------------|---------|
| WS1 | 恢復舊版 `systemPrompt()` 函數 |
| WS2 | 移除 `enforceConsistency()` 呼叫（fusion 層保持不變） |
| WS3 | 還原 `localMl.ts` 為 spawn 版本 + 設定 `ML_CWD` |
| WS4 | `localConfidence` 自動降為 0（LLM fallback 路徑不受影響） |

---

## 13. 時程估算

### Phase 1：開發（Week 1-2）

| 任務 | 工作天 | 依賴 |
|------|--------|------|
| WS1: 撰寫 Writing Band Descriptors prompt | 1 | - |
| WS1: 撰寫 Speaking Band Descriptors prompt | 1 | - |
| WS1: 單元測試 + Gold Set A/B | 1 | - |
| WS2: 實作 consistencyValidator.ts | 0.5 | - |
| WS2: 整合至 writingFusion + speakingFusion | 0.5 | - |
| WS2: 單元測試 | 0.5 | - |
| WS3: 撰寫 FastAPI api.py | 1 | - |
| WS3: 重構 score_cli.py 為可 import 模組 | 0.5 | - |
| WS3: 改寫 localMl.ts 為 HTTP client | 0.5 | - |
| WS3: Dockerfile + systemd service | 1 | - |
| WS4: 擴充 /score/speaking 回傳音訊特徵 | 0.5 | WS3 |
| WS4: speakingPipeline.ts 整合音訊特徵 | 0.5 | WS3 |

### Phase 2：部署與整合（Week 3）

| 任務 | 工作天 | 依賴 |
|------|--------|------|
| EC2 部署 FastAPI + Nginx 設定 | 1 | WS3 |
| Vercel 環境變數更新 | 0.5 | EC2 部署 |
| 端對端整合測試 | 1 | 全部 WS |
| 效能測試（延遲 + 吞吐量） | 0.5 | EC2 部署 |

### Phase 3：驗證與調校（Week 4）

| 任務 | 工作天 | 依賴 |
|------|--------|------|
| MAE Re-evaluation（Gold Set 20 篇） | 0.5 | Phase 2 |
| 擴充標注集至 50 篇 | 2 | - |
| 調校 prompt / consistency 參數 | 1 | Eval 結果 |
| 口說標注集建立（20 段） | 2 | - |

### Phase 4：上線（Week 5）

| 任務 | 工作天 | 依賴 |
|------|--------|------|
| Production 部署 | 0.5 | Phase 3 |
| 監控儀表板設定 | 0.5 | Production |
| README / 文件更新 | 0.5 | - |

**總計：約 18 工作天（3.5-4 週）**

---

## 附錄

### A. 相關檔案路徑

| 檔案 | 路徑 |
|------|------|
| Writing LLM Rubric | `apps/web/lib/scoring/llmWritingRubric.ts` |
| Speaking LLM Rubric | `apps/web/lib/scoring/llmSpeakingRubric.ts` |
| Writing Fusion | `apps/web/lib/scoring/writingFusion.ts` |
| Speaking Fusion | `apps/web/lib/scoring/speakingFusion.ts` |
| Local ML Client | `apps/web/lib/localMl.ts` |
| Local Adapters | `apps/web/lib/scoring/localAdapters.ts` |
| Writing Pipeline | `apps/web/lib/scoring/writingPipeline.ts` |
| Speaking Pipeline | `apps/web/lib/scoring/speakingPipeline.ts` |
| Calibration | `apps/web/lib/scoring/calibration.ts` |
| Schemas | `apps/web/lib/scoring/schemas.ts` |
| Types | `apps/web/lib/scoring/types.ts` |
| Score CLI | `ml/src/score_cli.py` |
| Speech Features | `ml/src/speech_features.py` |
| MAE Evaluator | `ml/tools/eval_writing_mae.py` |

### B. IELTS Band 分數對照表

| Band | 等級描述 | 0-1 對應區間 |
|------|---------|-------------|
| 9 | Expert User | 0.89 - 1.00 |
| 8 | Very Good User | 0.78 - 0.88 |
| 7 | Good User | 0.67 - 0.77 |
| 6 | Competent User | 0.56 - 0.66 |
| 5 | Modest User | 0.44 - 0.55 |
| 4 | Limited User | 0.33 - 0.43 |

### C. 參考資料

- IELTS Official Band Descriptors: https://www.ielts.org/for-organisations/ielts-scoring-in-detail
- ICML 2025 Hybrid AES Study — LLM + ML feature-based fusion for automated essay scoring
- librosa documentation: https://librosa.org/doc/latest/
- FastAPI documentation: https://fastapi.tiangolo.com/

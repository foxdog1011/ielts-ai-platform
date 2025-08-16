# IELTS AI Platform

一個提供 **IELTS Writing & Speaking 練習與自動評分** 的平台，使用 **Next.js App Router** + **OpenAI GPT** + **Vercel KV**。  

功能包含：
- ✍️ **Writing Task 2**：四構面評分（TR/CC/LR/GRA）、逐段建議、優化版本  
- 🎤 **Speaking Part 2**：錄音、自動/手動逐字稿、語音特徵（WPM、停頓數）  
- 📚 **題庫**：隨機抽題、AI 批量產生、內建種子題庫  
- 📝 **歷史紀錄**：儲存到 KV（可 fallback 至 memory）  

---

## 📦 專案結構

ielts-ai-platform/
├─ apps/
│ └─ web/ # Next.js 前端 + API
├─ ml/ # Python baseline（可選）
└─ README.md

yaml
複製
編輯

---

## 🚀 快速開始

```bash
# 進入 web app
cd apps/web

# 安裝套件
yarn

# 啟動 dev server（port:3001）
yarn dev -p 3001

# 瀏覽器打開 http://localhost:3001
🔐 環境變數設定
請在 apps/web/.env.local 建立以下內容：

env
複製
編輯
# --- OpenAI ---
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini
TEMPERATURE=0.2

# --- Vercel KV (Upstash) ---
# 沒設定時會自動 fallback 至 memory（本機測試可不填）
KV_REST_API_URL=https://xxx-yyy.upstash.io
KV_REST_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxx

# --- 語音轉寫（可選）---
ASR_MODEL=gpt-4o-mini-transcribe

# --- 本機 baseline（可選，只在 dev 使用）---
ML_CWD=/home/yourname/ielts-ai-monorepo/ml
PYTHON_BIN=/home/yourname/ielts-ai-monorepo/ml/.venv/bin/python
ALLOWED_AUDIO_ROOTS=/home/yourname/ielts-ai-monorepo/ml
📌 建立檔案指令（在專案根目錄執行）：

bash
複製
編輯
mkdir -p apps/web && touch apps/web/.env.local && ${EDITOR:-vi} apps/web/.env.local
✅ 健康檢查
啟動後執行：

bash
複製
編輯
curl -s http://localhost:3001/api/health | jq
預期輸出：

json
複製
編輯
{
  "ok": true,
  "env": {
    "OPENAI_API_KEY": "set"
  },
  "kv": {
    "provider": "vercel-kv",
    "ok": true
  }
}
📚 題庫操作
1) 種子題庫
bash
複製
編輯
curl -s -X POST http://localhost:3001/api/prompts/seed | jq
2) 隨機抽題
bash
複製
編輯
curl -s "http://localhost:3001/api/prompts/random?type=writing&part=task2" | jq
curl -s "http://localhost:3001/api/prompts/random?type=speaking&part=part2" | jq
3) 批量生成（AI 產生）
bash
複製
編輯
curl -s http://localhost:3001/api/prompts/generate \
  -H "content-type: application/json" \
  -d '{"type":"writing","part":"task2","count":6}' | jq
🛠 疑難排解
400 Unsupported parameter: 'response_format'
請確認：

已更新 openai SDK 至 v4+

使用 gpt-4o-mini 或其他支援 JSON mode 的模型

已改用 response_format: { type: "json_schema", ... } 或 text: { format: "json" }

首頁沒有歷史紀錄
確認 /api/history 是否回傳資料

沒有設定 KV 時，會使用 memory fallback（重啟 dev server 後會清空）

Writing 頁面殘留舊答案
點右上「清空草稿」，或在瀏覽器 console 執行：

js
複製
編輯
localStorage.clear()
🏗 部署到 Vercel
推送到 GitHub

Vercel Import 專案

在 Settings → Environment Variables 新增：

OPENAI_API_KEY

KV_REST_API_URL（建議）

KV_REST_API_TOKEN（建議）

📂 目錄結構（apps/web）
bash
複製
編輯
apps/web/
├─ app/
│  ├─ api/
│  │  ├─ writing/route.ts
│  │  ├─ speaking/route.ts
│  │  └─ prompts/
│  │     ├─ seed/route.ts
│  │     ├─ random/route.ts
│  │     └─ generate/route.ts
│  └─ page.tsx
├─ lib/
│  ├─ kv.ts
│  ├─ history.ts
│  └─ promptStore.ts
└─ public/
   └─ calibration/quantile_map.json
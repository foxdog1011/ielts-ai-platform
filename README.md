# IELTS AI — Web App

Next.js App Router 應用，提供 IELTS Writing / Speaking 練習、評分與歷史記錄。  
支援：
- **Writing**：四構面評分（TR/CC/LR/GRA）、段落建議、優化版本
- **Speaking**：本地/雲端 ASR（可選）、語音特徵、發音/流暢度
- **歷史記錄**：寫入 **Vercel KV**（本機無 KV 會自動 fallback 到記憶體）
- **題庫**：KV 支援的 prompt bank（`seed` / `random` / `generate`）

> **Node**：建議 Node 18+  
> **包管**：yarn v1（repo 目前使用）

---

## 1) 安裝與開發

```bash
cd apps/web
yarn
yarn dev -p 3001
# http://localhost:3001
2) 環境變數
存在 apps/web/.env.local（不要 commit 秘密）

env
複製
編輯
# --- OpenAI ---
OPENAI_API_KEY=sk-xxxx
OPENAI_MODEL=gpt-4o-mini
TEMPERATURE=0.2

# --- ASR（可選）---
ASR_MODEL=gpt-4o-mini-transcribe

# --- 本機 Baseline（可選，本機 Python）---
# 僅在你要跑 ml/ 裡面的 python baseline 時需要
ML_CWD=/home/yourname/ielts-ai-monorepo/ml
PYTHON_BIN=/home/yourname/ielts-ai-monorepo/ml/.venv/bin/python
ALLOWED_AUDIO_ROOTS=/home/yourname/ielts-ai-monorepo/ml

# --- Vercel KV（正式建議一定要）---
# 來源：Vercel Dashboard → Storage → 建立 KV（Upstash） → Connect → REST API
KV_REST_API_URL=https://xxxxx.upstash.io
KV_REST_API_TOKEN=xxxxx
檢查 KV 是否讀到：啟動後訪問
GET http://localhost:3001/api/health
kv.provider 應為 vercel-kv 並 hasUrl/hasToken: true。

3) 題庫（Prompt Bank）
3.1 種子題庫
第一次使用時先種一批題目：

bash
複製
編輯
curl -s -X POST http://localhost:3001/api/prompts/seed | jq
3.2 隨機抽一題
bash
複製
編輯
# Writing Task 2
curl -s "http://localhost:3001/api/prompts/random?type=writing&part=task2" | jq

# Speaking Part 2
curl -s "http://localhost:3001/api/prompts/random?type=speaking&part=part2" | jq
3.3 用 LLM 批量產生題目（追加進題庫）
bash
複製
編輯
curl -s http://localhost:3001/api/prompts/generate \
  -H 'content-type: application/json' \
  -d '{"type":"writing","part":"task2","count":6}' | jq
產生後會經 savePromptsUniq 去重並寫入 KV。

4) API 快速測試
4.1 健康檢查
bash
複製
編輯
curl -s http://localhost:3001/api/health | jq
4.2 Writing 評分
bash
複製
編輯
curl -s http://localhost:3001/api/writing \
  -H "content-type: application/json" \
  -d '{"taskId":"t1","prompt":"P","essay":"Your essay..."}' | jq
4.3 Speaking（本機音檔）
bash
複製
編輯
curl -s http://localhost:3001/api/speaking \
  -H "content-type: application/json" \
  -d '{"taskId":"s1","audioPath":"/abs/path/to.wav","transcript":"..."}' | jq
4.4 歷史紀錄（KV）
bash
複製
編輯
# 新增
curl -s http://localhost:3001/api/history \
  -H "content-type: application/json" \
  -d '{"type":"writing","taskId":"t-demo","prompt":"P","durationSec":120,"words":230,"band":{"overall":6.5}}' | jq

# 讀取
curl -s "http://localhost:3001/api/history?type=writing&limit=5" | jq
5) 校準曲線（Calibration）
前端頁面會讀 public/calibration/quantile_map.json 繪圖。
檔案存在時，/calibration 會顯示曲線與說明（若 404，請確認檔案存在並重啟 dev）。

6) 常見問題（Troubleshooting）
Q1. 400 Unsupported parameter: 'response_format' …
原因：用了 Responses API 的 response_format 參數，但 SDK v5 對 Responses API 需要改成 text.format。

本專案做法：Writing 與 Generate 都改回 Chat Completions 並使用 response_format: { type: "json_object" }，避免相容性雷。
若你自行修改，請確保 不要混用 Responses 的參數到 Chat Completions。

Q2. 首頁卡片顯示「尚未有紀錄」
請確認 /api/history 有資料（上面測試指令），且 /api/health 中 kv.provider 為 vercel-kv。

Q3. 抽題「[object Object] is not valid JSON」
已修：我們統一用 KV 儲存題目 JSON，讀取時不再重複 stringify/parse。
若出現，請確保 lib/kv.ts 使用 kvListTailJSON / kvListPushJSON 的新版實作。

Q4. Writing 頁面載入有上次草稿
這是預期行為（autosave：localStorage）。
清除方法：

手動：「清空草稿」按鈕

清 localStorage：key 形式 draft:writing:<taskId>

Q5. WSL 音檔權限
設定 ALLOWED_AUDIO_ROOTS 包含你的音檔根路徑。

/api/speaking 會檢查路徑白名單避免 Path Traversal。

7) 部署到 Vercel（建議）
建立 Project → 連接此 repo

於 Project → Settings → Environment Variables 設定：

OPENAI_API_KEY

OPENAI_MODEL（例：gpt-4o-mini）

KV_REST_API_URL / KV_REST_API_TOKEN

（可選）ASR_MODEL、TEMPERATURE

如用 KV：Dashboard → Storage → Upstash Redis（KV）→ Connect → 複製 REST URL/Token

Deploy

8) 目錄結構（精要）
bash
複製
編輯
apps/web/
  app/
    api/
      health/route.ts
      writing/route.ts
      speaking/route.ts
      prompts/
        seed/route.ts
        random/route.ts
        generate/route.ts
      history/route.ts
    page.tsx
    ...
  lib/
    kv.ts
    history.ts
    promptStore.ts
  public/
    calibration/quantile_map.json
yaml
複製
編輯

---

## Root README（放在 repo 根 `README.md` 的精簡版）

```md
# IELTS AI (Monorepo)

- `apps/web`：Next.js App（Writing/Speaking 評測、歷史記錄、KV 題庫）
- 其餘 `ml/` 等資料夾為本機 baseline 與資源（可選）

### 快速開始
```bash
cd apps/web
yarn
cp .env.local.example .env.local   # 自行填入 KEY（見檔案內注解）
yarn dev -p 3001
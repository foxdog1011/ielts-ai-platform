# 📘 IELTS AI Platform

一個整合 **OpenAI API** 的全方位 IELTS 練習平台。  
提供 **Writing** 與 **Speaking** 模擬題目、即時評分與歷史記錄功能。  

本專案採用 **Turborepo Monorepo 架構**，包含多個子專案，方便擴充與維護。

---

## 📂 專案結構

```bash
.
├── apps
│   ├── web        # Next.js 前端 (主應用程式)
│   └── api        # API 服務 (如需獨立拆出)
├── packages
│   ├── ui         # 共用 UI 元件
│   ├── config     # 共用設定 (tsconfig, eslint 等)
│   └── utils      # 共用工具方法
├── turbo.json     # Turborepo 設定
├── package.json   # Monorepo 根目錄依賴
└── README.md
🚀 功能特色
✍️ Writing

隨機抽題

自動批改與分數回饋 (Task Response / Coherence / Lexical / Grammar)

建議改善方向 & 優化版本

🎤 Speaking

抽題系統 (Part 1 / Part 2 / Part 3)

AI 模擬考官提問

即時評分與口說建議

📊 歷史紀錄

保存每次練習結果

可追蹤進步曲線

🧩 AI 題庫

支援自動生成題目

種子題庫 (初始備用題目)

⚙️ 環境需求
Node.js 18+

pnpm 9+ (建議)

OpenAI API Key

Vercel KV (可選，若無則使用 in-memory fallback)

🔑 環境變數
在 apps/web/.env.local 設定：

bash
複製
編輯
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
KV_REST_API_URL=your_vercel_kv_url   # (可選)
KV_REST_API_TOKEN=your_vercel_kv_token   # (可選)
🛠️ 安裝與啟動
bash
複製
編輯
# 1. 安裝依賴
pnpm install

# 2. 開發模式
pnpm dev

# 3. 指定子專案啟動 (例如 web)
pnpm --filter web dev

# 4. 建構
pnpm build

# 5. 測試 (如有設定)
pnpm test
📌 常用指令
bash
複製
編輯
# 種子題目
curl -X POST http://localhost:3001/api/prompts/seed

# 抽一題 Writing
curl "http://localhost:3001/api/prompts/random?type=writing&part=task2"

# 抽一題 Speaking
curl "http://localhost:3001/api/prompts/random?type=speaking&part=part2"

# 自動生成題庫
curl -X POST http://localhost:3001/api/prompts/generate \
  -H "content-type: application/json" \
  -d '{"type":"writing","part":"task2","count":5}'
📄 License
MIT License © 2025 foxdog
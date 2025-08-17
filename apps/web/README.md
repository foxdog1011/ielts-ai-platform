# 📘 IELTS AI Web

**IELTS AI Web** 是 IELTS AI 平台的前端應用，使用 [Next.js](https://nextjs.org/) + [TypeScript](https://www.typescriptlang.org/) 開發，並整合 **OpenAI API** 提供 Writing / Speaking 題目生成與自動評分功能。

---

## 📂 專案結構

```bash
apps/web
├── app/               # Next.js App Router
│   ├── api/           # API Routes (Edge Functions)
│   ├── components/    # React 元件
│   ├── page.tsx       # 首頁
│   └── ...
├── lib/               # 共用工具 (KV, promptStore, history)
├── public/            # 靜態檔案
├── styles/            # 樣式
└── README.md          # 本文件
🚀 開發啟動
bash
複製
編輯
# 進入 web app 資料夾
cd apps/web

# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev
啟動後，預設伺服器會運行在：

👉 http://localhost:3001

🔑 環境變數
請在 apps/web/.env.local 建立並設定：

bash
複製
編輯
# OpenAI API
OPENAI_API_KEY=sk-xxxx
OPENAI_MODEL=gpt-4o-mini

# KV 資料庫 (可選，本地測試可忽略)
KV_REST_API_URL=your-kv-url
KV_REST_API_TOKEN=your-kv-token
📝 功能
✍️ Writing
隨機抽題 / 題庫生成

自動評分：

Task Response (TR)

Coherence & Cohesion (CC)

Lexical Resource (LR)

Grammar (GRA)

分段反饋、改進建議、優化版本

🎤 Speaking
支援 Part 1 / Part 2 / Part 3 題目

Cue Card + 後續追問

隨機抽題

📜 歷史紀錄
自動儲存 Writing / Speaking 答案與分數

首頁顯示最近紀錄卡片

📦 部署
建議使用 Vercel 部署：

bash
複製
編輯
# 推送至 GitHub
git add .
git commit -m "Deploy IELTS AI Web"
git push origin main
在 Vercel 建立專案，並指定 root 為 apps/web。

🤝 貢獻
歡迎提交 Issue / PR，一起打造更好的 IELTS AI 練習平台 🚀

📜 授權
本專案採用 MIT License。
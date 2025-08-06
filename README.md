# IELTS AI Feedback Platform 🧠✍️🎤

一個支援 IELTS 寫作與口說任務的 AI 自動回饋平台，提供使用者更流暢、清晰的練習體驗。

## 🌐 專案介紹

本平台整合 OpenAI API 與現代化前端技術，實現模擬 IELTS 真實考試情境的互動體驗。目前支援：

- **Writing Task 2**：即時字數統計、AI 寫作批改、段落建議與改寫版本。
- **Speaking Task**：2 分鐘語音錄製、提示語、錄音狀態切換、時間計時等功能。

---

## 🧩 功能一覽

### ✍️ Writing Task

- ✅ 即時字數與字元統計（目標：250 字）
- ✅ 空白或太短禁止送出
- ✅ AI 回饋（Band 分數、段落評論、建議、改寫版本）
- ✅ 載入中提示：「Getting AI Feedback...」
- ✅ 成功樣式：漸層背景美化
- ✅ 錯誤處理與提示
- ✅ 輸入框指引：包含 essay 結構提示

---

### 🎤 Speaking Task

- ✅ 語音錄製功能（Start / Stop / Reset）
- ✅ 錄音計時（2 分鐘倒數計時）
- ✅ 錄音狀態顯示（表情符號 + 顏色）
- ✅ 題目提示與建議（提示框呈現）

---

### 🏠 首頁 Home Page

- ✅ 卡片式佈局，分為 Speaking / Writing
- ✅ 各任務卡片含時間/字數需求提示
- ✅ 使用 icon + 漸層色背景吸引用戶
- ✅ 段落式說明、功能 highlight 區塊

---

## 🛠 技術架構

| 技術 | 說明 |
|------|------|
| `Next.js 14` | 前端框架（App Router） |
| `Tailwind CSS` | UI 樣式處理 |
| `TypeScript` | 嚴謹型別檢查 |
| `OpenAI API` | AI 寫作回饋引擎 |
| `Monorepo` | 使用 `apps/` 與 `packages/` 分層 |
| `Docker` (optional) | 未來可容器化部署 |

---

## 🗂 專案結構（Monorepo）


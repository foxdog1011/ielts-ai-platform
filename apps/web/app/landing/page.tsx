// apps/web/app/landing/page.tsx
"use client";

import Link from "next/link";
import { useState } from "react";

/* ---------- Icon components (inline SVG for zero dependencies) ---------- */

function IconAI() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="12" fill="#58CC02" />
      <path
        d="M12 28V14l8-4 8 4v14l-8 4-8-4z"
        stroke="#fff"
        strokeWidth="2"
        fill="none"
      />
      <circle cx="20" cy="20" r="3" fill="#fff" />
    </svg>
  );
}

function IconMic() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="12" fill="#1CB0F6" />
      <rect x="16" y="10" width="8" height="14" rx="4" fill="#fff" />
      <path d="M14 22a6 6 0 0012 0" stroke="#fff" strokeWidth="2" />
      <line x1="20" y1="28" x2="20" y2="32" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

function IconPen() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="12" fill="#FF4B4B" />
      <path
        d="M14 26l-2 4 4-2 12-12-2-2L14 26z"
        stroke="#fff"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}

function IconExam() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="12" fill="#FFD900" />
      <rect x="12" y="10" width="16" height="20" rx="2" stroke="#fff" strokeWidth="2" fill="none" />
      <line x1="16" y1="16" x2="24" y2="16" stroke="#fff" strokeWidth="2" />
      <line x1="16" y1="20" x2="24" y2="20" stroke="#fff" strokeWidth="2" />
      <line x1="16" y1="24" x2="20" y2="24" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

function IconCommunity() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="12" fill="#CE82FF" />
      <circle cx="16" cy="16" r="4" stroke="#fff" strokeWidth="2" fill="none" />
      <circle cx="24" cy="16" r="4" stroke="#fff" strokeWidth="2" fill="none" />
      <path d="M10 30c0-4 4-7 10-7s10 3 10 7" stroke="#fff" strokeWidth="2" fill="none" />
    </svg>
  );
}

function IconGame() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="12" fill="#58CC02" />
      <polygon points="20,10 25,18 33,18 27,24 29,32 20,27 11,32 13,24 7,18 15,18" stroke="#fff" strokeWidth="2" fill="none" />
    </svg>
  );
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/* ---------- Data ---------- */

const features = [
  {
    icon: <IconAI />,
    title: "AI 即時評分",
    desc: "提交後數秒內獲得詳細評分與建議，涵蓋 Task Achievement、Coherence、Lexical Resource、Grammar 四大面向。",
  },
  {
    icon: <IconMic />,
    title: "口說練習",
    desc: "模擬真實口說考試三個 Part，AI 即時分析發音、流暢度與詞彙使用，給予具體改善建議。",
  },
  {
    icon: <IconPen />,
    title: "寫作批改",
    desc: "Task 1 & Task 2 全面批改，AI 逐段分析結構、論點與文法錯誤，附帶範文參考。",
  },
  {
    icon: <IconExam />,
    title: "模擬考試",
    desc: "完整模擬 Listening、Reading、Writing、Speaking 四科考試環境，精準計時與評分。",
  },
  {
    icon: <IconCommunity />,
    title: "社群題庫",
    desc: "考生共享真實考題，AI 自動分類與難度標註。練習最新題庫，掌握出題趨勢。",
  },
  {
    icon: <IconGame />,
    title: "遊戲化學習",
    desc: "連續學習天數、XP 經驗值、排行榜、每日挑戰，讓備考不再枯燥。",
  },
];

interface PricingFeature {
  readonly name: string;
  readonly free: string;
  readonly pro: string;
}

const pricingFeatures: readonly PricingFeature[] = [
  { name: "每日練習次數", free: "3 次", pro: "無限制" },
  { name: "AI 寫作批改", free: "基礎評分", pro: "詳細逐段批改 + 範文" },
  { name: "AI 口說分析", free: "基礎回饋", pro: "深度發音 + 語法分析" },
  { name: "模擬考試", free: "每月 1 次", pro: "無限制" },
  { name: "社群題庫", free: "瀏覽", pro: "完整存取 + 下載" },
  { name: "學習數據分析", free: "基本統計", pro: "進階趨勢圖表" },
  { name: "排行榜 & 成就", free: "有", pro: "有 + 專屬徽章" },
  { name: "優先客服", free: "---", pro: "有" },
];

interface FAQItem {
  readonly q: string;
  readonly a: string;
}

const faqs: readonly FAQItem[] = [
  {
    q: "IELTS AI 的評分準確嗎？",
    a: "我們的 AI 模型基於大量雅思官方評分標準訓練，評分結果與真實考試高度相關。系統持續根據考生回饋優化，目前寫作評分誤差在 0.5 分以內。",
  },
  {
    q: "免費版有什麼限制？",
    a: "免費版每日可進行 3 次練習，包含基礎 AI 評分回饋。如需無限練習次數、詳細批改與完整模擬考，建議升級至 Pro 版。",
  },
  {
    q: "支援哪些 IELTS 考試類型？",
    a: "目前支援 Academic 與 General Training 兩種考試類型的 Writing 和 Speaking 練習。Listening 和 Reading 模組持續開發中。",
  },
  {
    q: "口說練習需要什麼設備？",
    a: "只需要一台有麥克風的電腦或手機即可。建議使用 Chrome 或 Edge 瀏覽器以獲得最佳語音辨識效果。",
  },
  {
    q: "資料會被保存多久？",
    a: "所有練習紀錄永久保存在你的帳戶中。你可以隨時回顧過往練習、追蹤進步趨勢。我們嚴格保護用戶隱私，資料僅用於你個人的學習分析。",
  },
  {
    q: "可以取消 Pro 訂閱嗎？",
    a: "可以，隨時取消。取消後你仍可使用 Pro 功能直到當期結束，之後自動降級為免費版。不會收取額外費用。",
  },
];

/* ---------- FAQ Accordion Item ---------- */

function FAQAccordion({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-2 border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-6 py-4 text-left font-bold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <span>{item.q}</span>
        <ChevronDown open={open} />
      </button>
      {open && (
        <div className="px-6 pb-5 text-gray-600 dark:text-gray-300 leading-relaxed">
          {item.a}
        </div>
      )}
    </div>
  );
}

/* ---------- Main Page ---------- */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* ===== Nav ===== */}
      <nav className="sticky top-0 z-50 bg-white/90 dark:bg-gray-950/90 backdrop-blur border-b-2 border-gray-100 dark:border-gray-800">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <Link
            href="/landing"
            className="text-xl font-bold text-[#58CC02] tracking-tight"
          >
            IELTS AI
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden sm:inline-block text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-[#58CC02] transition-colors"
            >
              登入
            </Link>
            <Link
              href="/"
              className="bg-[#58CC02] hover:bg-[#4CAF00] text-white font-bold text-sm px-5 py-2 rounded-2xl border-2 border-[#4CAF00] shadow-[0_4px_0_#3D8C00] active:shadow-none active:translate-y-1 transition-all"
            >
              免費開始
            </Link>
          </div>
        </div>
      </nav>

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight">
            <span className="text-[#58CC02]">AI 驅動</span>的
            <br className="sm:hidden" />
            IELTS 備考平台
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            即時寫作批改、口說練習、模擬考試與遊戲化學習，
            <br className="hidden sm:block" />
            讓你用最聰明的方式準備雅思，快速達到目標分數。
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/"
              className="bg-[#58CC02] hover:bg-[#4CAF00] text-white font-bold text-lg px-8 py-4 rounded-2xl border-2 border-[#4CAF00] shadow-[0_4px_0_#3D8C00] active:shadow-none active:translate-y-1 transition-all"
            >
              免費開始練習
            </Link>
            <a
              href="#features"
              className="text-[#1CB0F6] font-bold text-lg hover:underline"
            >
              了解更多 &darr;
            </a>
          </div>
          {/* Social proof */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm font-bold text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-2">
              <span className="text-[#FFD900] text-xl">&#9733;</span> 4.8 / 5
              平均評分
            </span>
            <span className="hidden sm:block w-1 h-1 rounded-full bg-gray-300" />
            <span>已有 12,000+ 位考生使用</span>
            <span className="hidden sm:block w-1 h-1 rounded-full bg-gray-300" />
            <span>平均提升 1.0 分</span>
          </div>
        </div>
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 bg-[#58CC02]/10 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 bg-[#1CB0F6]/10 rounded-full blur-3xl" />
      </section>

      {/* ===== Features ===== */}
      <section id="features" className="py-16 sm:py-24 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
            為什麼選擇 <span className="text-[#58CC02]">IELTS AI</span>？
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-12 max-w-xl mx-auto">
            六大核心功能，全方位提升你的雅思成績
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 p-6 shadow-[0_4px_0_#e5e7eb] dark:shadow-[0_4px_0_#374151] hover:-translate-y-1 transition-transform"
              >
                <div className="mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section className="py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-12">
            三步開始你的 <span className="text-[#FFD900]">高效備考</span>
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                color: "#58CC02",
                title: "免費註冊",
                desc: "30 秒完成註冊，立即開始練習",
              },
              {
                step: "2",
                color: "#1CB0F6",
                title: "AI 即時練習",
                desc: "選擇寫作或口說題目，提交後獲得 AI 批改",
              },
              {
                step: "3",
                color: "#FF4B4B",
                title: "追蹤進步",
                desc: "查看分數趨勢，針對弱點重點練習",
              },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4 border-2 shadow-[0_4px_0_rgba(0,0,0,0.15)]"
                  style={{ backgroundColor: s.color, borderColor: s.color }}
                >
                  {s.step}
                </div>
                <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Pricing ===== */}
      <section id="pricing" className="py-16 sm:py-24 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
            方案比較
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-12">
            免費版即可開始，Pro 版解鎖全部功能
          </p>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left p-4 font-bold text-gray-500 dark:text-gray-400">
                    功能
                  </th>
                  <th className="p-4 text-center">
                    <div className="font-bold text-lg">免費版</div>
                    <div className="text-gray-500 text-sm">NT$0 / 月</div>
                  </th>
                  <th className="p-4 text-center">
                    <div className="font-bold text-lg text-[#58CC02]">
                      Pro 版
                    </div>
                    <div className="text-gray-500 text-sm">NT$299 / 月</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pricingFeatures.map((f, i) => (
                  <tr
                    key={f.name}
                    className={
                      i % 2 === 0
                        ? "bg-white dark:bg-gray-800"
                        : "bg-gray-50 dark:bg-gray-900"
                    }
                  >
                    <td className="p-4 font-bold text-sm">{f.name}</td>
                    <td className="p-4 text-center text-sm text-gray-600 dark:text-gray-400">
                      {f.free}
                    </td>
                    <td className="p-4 text-center text-sm font-bold text-[#58CC02]">
                      {f.pro}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-4">
            {/* Free */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-xl font-bold mb-1">免費版</h3>
              <p className="text-2xl font-bold mb-4">
                NT$0<span className="text-sm text-gray-500 font-normal"> / 月</span>
              </p>
              <ul className="space-y-2 text-sm">
                {pricingFeatures.map((f) => (
                  <li key={f.name} className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{f.name}</span>
                    <span className="font-bold">{f.free}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Pro */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-[#58CC02] p-6 shadow-[0_4px_0_#3D8C00]">
              <h3 className="text-xl font-bold text-[#58CC02] mb-1">Pro 版</h3>
              <p className="text-2xl font-bold mb-4">
                NT$299<span className="text-sm text-gray-500 font-normal"> / 月</span>
              </p>
              <ul className="space-y-2 text-sm">
                {pricingFeatures.map((f) => (
                  <li key={f.name} className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{f.name}</span>
                    <span className="font-bold text-[#58CC02]">{f.pro}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="text-center mt-10">
            <Link
              href="/"
              className="inline-block bg-[#58CC02] hover:bg-[#4CAF00] text-white font-bold text-lg px-8 py-4 rounded-2xl border-2 border-[#4CAF00] shadow-[0_4px_0_#3D8C00] active:shadow-none active:translate-y-1 transition-all"
            >
              免費開始練習
            </Link>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">
            常見問題
          </h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <FAQAccordion key={faq.q} item={faq} />
            ))}
          </div>
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className="py-16 sm:py-24 bg-[#58CC02]">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            準備好提升你的雅思成績了嗎？
          </h2>
          <p className="text-white/90 text-lg mb-8">
            加入 12,000+ 位考生的行列，免費開始你的 AI 備考旅程。
          </p>
          <Link
            href="/"
            className="inline-block bg-white hover:bg-gray-50 text-[#58CC02] font-bold text-lg px-8 py-4 rounded-2xl border-2 border-white shadow-[0_4px_0_rgba(0,0,0,0.15)] active:shadow-none active:translate-y-1 transition-all"
          >
            免費開始練習
          </Link>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="bg-gray-900 dark:bg-gray-950 text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid sm:grid-cols-3 gap-8">
            {/* Brand */}
            <div>
              <p className="text-xl font-bold text-white mb-2">IELTS AI</p>
              <p className="text-sm leading-relaxed">
                AI 驅動的雅思備考平台，幫助你更聰明地準備 IELTS 考試。
              </p>
            </div>
            {/* Practice */}
            <div>
              <p className="font-bold text-white mb-3">練習</p>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/writing" className="hover:text-white transition-colors">
                    寫作練習
                  </Link>
                </li>
                <li>
                  <Link href="/speaking" className="hover:text-white transition-colors">
                    口說練習
                  </Link>
                </li>
                <li>
                  <Link href="/listening" className="hover:text-white transition-colors">
                    聽力練習
                  </Link>
                </li>
                <li>
                  <Link href="/community" className="hover:text-white transition-colors">
                    社群題庫
                  </Link>
                </li>
              </ul>
            </div>
            {/* Resources */}
            <div>
              <p className="font-bold text-white mb-3">資源</p>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/leaderboard" className="hover:text-white transition-colors">
                    排行榜
                  </Link>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-white transition-colors">
                    方案比較
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white transition-colors">
                    常見問題
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-gray-800 text-center text-xs">
            &copy; {new Date().getFullYear()} IELTS AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

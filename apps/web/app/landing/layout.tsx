// apps/web/app/landing/layout.tsx

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IELTS AI - AI 驅動的雅思備考平台 | 免費開始練習",
  description:
    "IELTS AI 是一個 AI 驅動的雅思備考平台，提供即時寫作批改、口說練習、模擬考試、社群題庫與遊戲化學習。免費開始，快速提升你的 IELTS 成績。",
  openGraph: {
    title: "IELTS AI - AI 驅動的雅思備考平台",
    description:
      "AI 即時評分、口說練習、寫作批改、模擬考試。免費開始，快速提升你的雅思成績。",
    type: "website",
    locale: "zh_TW",
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

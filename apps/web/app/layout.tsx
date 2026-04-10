// apps/web/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

import { Inter } from "next/font/google";
import { Noto_Sans_TC } from "next/font/google";
import { ToastProvider } from "../components/Toast";
import { SessionProvider } from "@/features/auth/components/SessionProvider";

export const metadata: Metadata = {
  title: {
    default: "IELTS AI - AI 驅動的雅思備考平台",
    template: "%s | IELTS AI",
  },
  description:
    "IELTS AI 是一個 AI 驅動的雅思備考平台，提供即時寫作批改、口說練習、模擬考試、社群題庫與遊戲化學習。免費開始，快速提升你的 IELTS 成績。",
  keywords: [
    "IELTS",
    "雅思",
    "雅思備考",
    "AI 寫作批改",
    "IELTS Writing",
    "IELTS Speaking",
    "雅思口說練習",
    "雅思模擬考",
    "IELTS 線上練習",
  ],
  authors: [{ name: "IELTS AI" }],
  openGraph: {
    title: "IELTS AI - AI 驅動的雅思備考平台",
    description:
      "AI 即時評分、口說練習、寫作批改、模擬考試。免費開始，快速提升你的雅思成績。",
    type: "website",
    locale: "zh_TW",
    siteName: "IELTS AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "IELTS AI - AI 驅動的雅思備考平台",
    description:
      "AI 即時評分、口說練習、寫作批改、模擬考試。免費開始，快速提升你的雅思成績。",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const notoSansTC = Noto_Sans_TC({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-noto-sans-tc",
  display: "swap",
});

// Inline script to prevent flash of wrong theme on load.
// Reads localStorage and system preference, applies `dark` class before paint.
const themeInitScript = `
(function(){
  try {
    var s = localStorage.getItem('theme');
    var d = s ? s === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (d) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch(e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" className={`${inter.variable} ${notoSansTC.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-brand antialiased theme-transition">
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}

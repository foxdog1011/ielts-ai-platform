// apps/web/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

// 如果你有用 next/font，保留/調整你的字體設定；以下是範例：
import { Inter } from "next/font/google";
import { Noto_Sans_TC } from "next/font/google";
import { ToastProvider } from "../components/Toast";

export const metadata: Metadata = {
  title: "IELTS AI",
  description: "IELTS Writing & Speaking",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" className={`${inter.variable} ${notoSansTC.variable}`}>
      <body className="font-brand antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

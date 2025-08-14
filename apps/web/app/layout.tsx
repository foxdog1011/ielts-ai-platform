// apps/web/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

// 如果你有用 next/font，保留/調整你的字體設定；以下是範例：
import { Plus_Jakarta_Sans } from "next/font/google";
import { Noto_Serif_TC } from "next/font/google"; // 若你用 local 請改成 localFont
import { ToastProvider } from "../components/Toast";

export const metadata: Metadata = {
  title: "IELTS AI",
  description: "IELTS Writing & Speaking",
};

// 字體（請依你的實際需求調整）
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});
const notoSerifTC = Noto_Serif_TC({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-noto-serif-tc",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" className={`${plusJakarta.variable} ${notoSerifTC.variable}`}>
      <body className="font-brand antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

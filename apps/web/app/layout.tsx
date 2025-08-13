import "./globals.css";
import { Plus_Jakarta_Sans, Noto_Serif_TC } from "next/font/google";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const notoSerifTC = Noto_Serif_TC({
  // Noto Serif TC 沒有 CJK 子集參數可選，保留 latin 即可；中文字形會載入。
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-serif-tc",
  display: "swap",
});

export const metadata = {
  title: "IELTS AI",
  description: "IELTS Writing & Speaking Practice Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" className={`${plusJakarta.variable} ${notoSerifTC.variable}`}>
      <body>{children}</body>
    </html>
  );
}

// apps/web/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

import { Inter } from "next/font/google";
import { Noto_Sans_TC } from "next/font/google";
import { ToastProvider } from "../components/Toast";
import { SessionProvider } from "@/features/auth/components/SessionProvider";

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
      <body className="font-brand antialiased">
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}

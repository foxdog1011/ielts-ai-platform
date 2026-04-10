"use client";

import { useState } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/history", label: "歷史紀錄", icon: "📋" },
  { href: "/prompts", label: "題庫", icon: "📝" },
  { href: "/goals", label: "練習目標", icon: "🎯" },
  { href: "/notebook", label: "錯題本", icon: "📓" },
  { href: "/mock-exam", label: "模擬考", icon: "📝" },
  { href: "/calibration", label: "校準曲線", icon: "📊" },
  { href: "/leaderboard", label: "排行榜", icon: "🏆" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-11 h-11 rounded-xl border-2 border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] dark:text-[var(--text)] hover:bg-gray-50 dark:hover:bg-[var(--surface-raised)] transition-colors shadow-[2px_2px_0_0_rgba(0,0,0,0.1)] dark:shadow-[2px_2px_0_0_rgba(0,0,0,0.3)] active:shadow-[1px_1px_0_0_rgba(0,0,0,0.1)] active:translate-x-[1px] active:translate-y-[1px]"
        aria-label="開啟選單"
        aria-expanded={open}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          {open ? (
            <>
              <line x1="5" y1="5" x2="15" y2="15" />
              <line x1="15" y1="5" x2="5" y2="15" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="17" y2="6" />
              <line x1="3" y1="10" x2="17" y2="10" />
              <line x1="3" y1="14" x2="17" y2="14" />
            </>
          )}
        </svg>
      </button>
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-2xl border-2 border-gray-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0_0_rgba(0,0,0,0.4)] py-2 overflow-hidden">
            {NAV_LINKS.map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-5 py-3.5 text-[15px] font-bold text-gray-700 dark:text-[var(--text-secondary)] hover:bg-[#58CC02]/10 hover:text-[#58CC02] transition-colors"
              >
                <span className="text-[18px]">{icon}</span>
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

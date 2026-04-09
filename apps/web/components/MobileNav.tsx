"use client";

import { useState } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/history", label: "歷史紀錄" },
  { href: "/prompts", label: "題庫" },
  { href: "/goals", label: "練習目標" },
  { href: "/notebook", label: "錯題本" },
  { href: "/calibration", label: "校準曲線" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-11 h-11 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors"
        aria-label="開啟選單"
        aria-expanded={open}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
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
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-xl border border-zinc-200 bg-white shadow-lg py-2">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="block px-4 py-3 text-[14px] text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

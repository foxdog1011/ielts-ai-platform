"use client";

// features/gamification/components/XPBar.tsx
//
// Horizontal progress bar showing XP toward next level.
// Animated fill on XP gain. Shows level number.

import { useEffect, useState } from "react";
import type { XPInfo } from "@/features/gamification/xp-service";

interface XPBarProps {
  readonly initialXP: XPInfo;
}

export function XPBar({ initialXP }: XPBarProps) {
  const [xp, setXP] = useState(initialXP);
  const [animateWidth, setAnimateWidth] = useState(false);

  // Trigger fill animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setAnimateWidth(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Poll for XP updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/gamification/xp");
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setXP(json.data);
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const nextLevelXP = xp.xpToNextLevel + xp.totalXP;
  const currentLevelXP = xp.level * xp.level * 100;
  const progressInLevel = xp.totalXP - currentLevelXP;
  const levelRange = nextLevelXP - currentLevelXP;
  const pct = levelRange > 0 ? Math.min(100, (progressInLevel / levelRange) * 100) : 0;

  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
      {/* Level badge */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#CE82FF] to-[#A855F7] text-[14px] font-bold text-white shadow-[2px_2px_0_0_rgba(0,0,0,0.15)]">
        {xp.level}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-bold text-gray-700">
            等級 {xp.level}
          </span>
          <span className="font-bold text-[#CE82FF]">
            {xp.totalXP} XP
          </span>
        </div>
        {/* Progress bar */}
        <div className="mt-1.5 h-3 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#CE82FF] to-[#A855F7] transition-all duration-700 ease-out"
            style={{ width: animateWidth ? `${pct}%` : "0%" }}
          />
        </div>
        <div className="mt-1 text-[11px] font-bold text-gray-400">
          還需 {xp.xpToNextLevel} XP 升級
        </div>
      </div>
    </div>
  );
}

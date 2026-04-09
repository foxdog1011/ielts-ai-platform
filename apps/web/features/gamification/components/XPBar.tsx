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
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2">
      {/* Level badge */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-400 text-[11px] font-bold text-white shadow-sm">
        {xp.level}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-zinc-700">
            Lv.{xp.level}
          </span>
          <span className="text-zinc-400">
            {xp.totalXP} XP
          </span>
        </div>
        {/* Progress bar */}
        <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500 transition-all duration-700 ease-out"
            style={{ width: animateWidth ? `${pct}%` : "0%" }}
          />
        </div>
        <div className="mt-0.5 text-[10px] text-zinc-400">
          還需 {xp.xpToNextLevel} XP 升級
        </div>
      </div>
    </div>
  );
}

"use client";

// features/gamification/components/StreakBadge.tsx
//
// Displays current streak with fire emoji and optional freeze count.
// Animates on streak increment via a scale pulse.

import { useEffect, useState } from "react";
import type { StreakInfo } from "@/features/gamification/streak-service";

interface StreakBadgeProps {
  readonly initialStreak: StreakInfo;
}

export function StreakBadge({ initialStreak }: StreakBadgeProps) {
  const [streak, setStreak] = useState(initialStreak);
  const [animate, setAnimate] = useState(false);

  // Trigger animation when streak changes
  useEffect(() => {
    if (streak.currentStreak > 0) {
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 600);
      return () => clearTimeout(timer);
    }
  }, [streak.currentStreak]);

  // Poll for streak updates (lightweight, runs every 60s)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/gamification/streak");
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setStreak(json.data);
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (streak.currentStreak === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
        <span className="text-2xl">{"🔥"}</span>
        <div>
          <div className="text-[13px] font-bold text-gray-400">連續練習</div>
          <div className="text-lg font-bold text-gray-300">0 天</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        "flex items-center gap-3 rounded-2xl border-2 px-4 py-3 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] transition-all duration-300",
        streak.currentStreak >= 7
          ? "border-[#FF4B4B] bg-[#FF4B4B]/10"
          : "border-[#FFD900] bg-[#FFD900]/10",
        animate ? "scale-105" : "scale-100",
      ].join(" ")}
    >
      <span className={`text-2xl ${animate ? "animate-bounce" : ""}`}>{"🔥"}</span>
      <div>
        <div className="text-[13px] font-bold text-gray-500">連續練習</div>
        <div className="text-xl font-bold text-gray-800">{streak.currentStreak} 天</div>
      </div>
      {streak.streakFreezes > 0 && (
        <span
          className="ml-auto rounded-xl bg-[#1CB0F6]/15 px-2.5 py-1 text-[12px] font-bold text-[#1CB0F6]"
          title={`${streak.streakFreezes} 個保護卡`}
        >
          {"🛡️"} {streak.streakFreezes}
        </span>
      )}
    </div>
  );
}

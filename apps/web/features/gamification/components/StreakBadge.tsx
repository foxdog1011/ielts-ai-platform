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
      <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-[12px] text-zinc-400">
        <span>{"🔥"}</span>
        <span>0 天</span>
      </div>
    );
  }

  return (
    <div
      className={[
        "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-medium transition-all duration-300",
        streak.currentStreak >= 7
          ? "border-orange-300 bg-orange-50 text-orange-800"
          : "border-amber-200 bg-amber-50 text-amber-800",
        animate ? "scale-110" : "scale-100",
      ].join(" ")}
    >
      <span className={animate ? "animate-bounce" : ""}>{"🔥"}</span>
      <span>{streak.currentStreak} 天</span>
      {streak.streakFreezes > 0 && (
        <span
          className="ml-1 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700"
          title={`${streak.streakFreezes} 個保護卡`}
        >
          {"🛡️"} {streak.streakFreezes}
        </span>
      )}
    </div>
  );
}

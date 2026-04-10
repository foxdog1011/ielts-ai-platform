"use client";

// features/gamification/components/DailyChallenge.tsx
//
// Card showing today's challenge prompt.
// "Start Challenge" button navigates to writing/speaking page with prompt.
// Shows green check if already completed today.

import { useState } from "react";
import Link from "next/link";
import type { DailyChallenge as DailyChallengeType } from "@/features/gamification/daily-challenge";

interface DailyChallengeProps {
  readonly challenge: DailyChallengeType;
}

export function DailyChallenge({ challenge }: DailyChallengeProps) {
  const [completed] = useState(challenge.completed);

  const targetHref =
    challenge.type === "writing"
      ? `/tasks/1/writing?q=${encodeURIComponent(challenge.prompt)}`
      : `/tasks/1/speaking?q=${encodeURIComponent(challenge.prompt)}`;

  const typeLabel = challenge.type === "writing" ? "寫作" : "口說";
  const typeBadgeClass =
    challenge.type === "writing"
      ? "bg-[#1CB0F6]/15 text-[#1CB0F6] border-[#1CB0F6]/30"
      : "bg-[#FFD900]/20 text-[#B8960F] border-[#FFD900]/40";

  return (
    <div className="rounded-2xl border-2 border-[#58CC02]/40 bg-[#58CC02]/5 p-5 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{"🎯"}</span>
          <h3 className="text-[15px] font-bold text-gray-800">
            每日挑戰
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-xl border-2 px-2.5 py-1 text-[11px] font-bold ${typeBadgeClass}`}>
            {typeLabel}
          </span>
          {completed && (
            <span className="rounded-xl bg-[#58CC02]/15 px-2.5 py-1 text-[11px] font-bold text-[#58CC02]">
              {"✅"} 已完成
            </span>
          )}
        </div>
      </div>

      <p className="text-[13px] leading-relaxed text-gray-600 line-clamp-3 font-medium">
        {challenge.prompt}
      </p>

      <div className="mt-4 flex items-center justify-between">
        <span className="rounded-xl bg-[#FFD900]/20 px-2.5 py-1 text-[12px] font-bold text-[#B8960F]">
          +100 XP ⚡
        </span>
        {completed ? (
          <span className="rounded-xl border-2 border-[#58CC02] bg-[#58CC02]/10 px-5 py-2 text-[13px] font-bold text-[#58CC02] shadow-[2px_2px_0_0_rgba(0,0,0,0.1)]">
            {"✅"} 已完成
          </span>
        ) : (
          <Link
            href={targetHref}
            className="rounded-xl border-2 border-[#58CC02] bg-[#58CC02] px-5 py-2 text-[13px] font-bold text-white hover:bg-[#4CAD02] transition-colors shadow-[2px_2px_0_0_rgba(0,0,0,0.15)] active:shadow-[1px_1px_0_0_rgba(0,0,0,0.15)] active:translate-x-[1px] active:translate-y-[1px]"
          >
            開始挑戰 🚀
          </Link>
        )}
      </div>
    </div>
  );
}

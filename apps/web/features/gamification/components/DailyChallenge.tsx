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

  const typeLabel = challenge.type === "writing" ? "Writing" : "Speaking";
  const typeBadgeClass =
    challenge.type === "writing"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <div className="rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/50 to-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[14px]">{"🎯"}</span>
          <h3 className="text-[13px] font-semibold text-zinc-800">
            每日挑戰
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${typeBadgeClass}`}>
            {typeLabel}
          </span>
          {completed && (
            <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
              {"✅"} 已完成
            </span>
          )}
        </div>
      </div>

      <p className="text-[13px] leading-relaxed text-zinc-600 line-clamp-3">
        {challenge.prompt}
      </p>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-[11px] text-zinc-400">
          +100 XP
        </span>
        {completed ? (
          <span className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-[12px] font-medium text-emerald-700">
            {"✅"} 完成
          </span>
        ) : (
          <Link
            href={targetHref}
            className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-[12px] font-medium text-emerald-800 hover:bg-emerald-100 transition-colors"
          >
            開始挑戰
          </Link>
        )}
      </div>
    </div>
  );
}

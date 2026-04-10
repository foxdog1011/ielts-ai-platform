"use client";

// features/gamification/components/WeeklyGoal.tsx
//
// Circular-style progress display toward weekly practice goal.
// Users can adjust the target with +/- buttons. Celebrates when goal is met.

import { useEffect, useState, useCallback } from "react";
import type { WeeklyGoal as WeeklyGoalType } from "@/features/gamification/weekly-goals";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface GoalResponse {
  readonly ok: boolean;
  readonly data?: WeeklyGoalType;
  readonly error?: string;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function WeeklyGoal() {
  const [goal, setGoal] = useState<WeeklyGoalType | null>(null);
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState(false);

  const fetchGoal = useCallback(async () => {
    try {
      const res = await fetch("/api/gamification/weekly");
      if (!res.ok) return;
      const json: GoalResponse = await res.json();
      if (json.data) {
        setGoal(json.data);
      }
    } catch {
      // Silently ignore fetch errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoal();
  }, [fetchGoal]);

  const adjustTarget = useCallback(
    async (delta: number) => {
      if (!goal || adjusting) return;
      const newTarget = Math.max(1, Math.min(14, goal.target + delta));
      if (newTarget === goal.target) return;

      setAdjusting(true);
      try {
        const res = await fetch("/api/gamification/weekly", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: newTarget }),
        });
        if (res.ok) {
          const json: GoalResponse = await res.json();
          if (json.data) {
            setGoal(json.data);
          }
        }
      } catch {
        // Silently ignore errors
      } finally {
        setAdjusting(false);
      }
    },
    [goal, adjusting],
  );

  if (loading) {
    return (
      <div className="animate-pulse text-sm font-bold text-gray-400">
        載入週目標...
      </div>
    );
  }

  if (!goal) {
    return null;
  }

  const progress = Math.min(goal.completed / goal.target, 1);
  const percentage = Math.round(progress * 100);
  const isComplete = goal.completed >= goal.target;

  return (
    <div
      className={[
        "rounded-2xl border-2 px-5 py-5 transition-all duration-300 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]",
        isComplete
          ? "border-[#58CC02] bg-[#58CC02]/10"
          : "border-gray-200 bg-white",
      ].join(" ")}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[15px] font-bold text-gray-800">
          {isComplete ? "🎉 週目標達成!" : "📅 本週目標"}
        </span>
        <span className="rounded-xl bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-400">
          {goal.weekId}
        </span>
      </div>

      {/* Progress count */}
      <div className="mb-3 text-center">
        <span className={`text-4xl font-bold ${isComplete ? "text-[#58CC02]" : "text-gray-800"}`}>
          {goal.completed}
        </span>
        <span className="text-xl font-bold text-gray-400">
          {" / "}
          {goal.target}
        </span>
        <div className="mt-1 text-[13px] font-bold text-gray-400">
          次練習
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-4 overflow-hidden rounded-full bg-gray-100 border-2 border-gray-200">
        <div
          className={[
            "h-full rounded-full transition-all duration-500 ease-out",
            isComplete
              ? "bg-gradient-to-r from-[#58CC02] to-[#4CAD02]"
              : "bg-gradient-to-r from-[#1CB0F6] to-[#1899D6]",
          ].join(" ")}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Adjust target buttons */}
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => adjustTarget(-1)}
          disabled={adjusting || goal.target <= 1}
          className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-gray-200 text-lg font-bold text-gray-500 transition-colors hover:bg-gray-50 hover:border-gray-300 disabled:opacity-30 shadow-[2px_2px_0_0_rgba(0,0,0,0.1)] active:shadow-[1px_1px_0_0_rgba(0,0,0,0.1)] active:translate-x-[1px] active:translate-y-[1px]"
          aria-label="減少目標"
        >
          −
        </button>
        <span className="text-[13px] font-bold text-gray-400">
          調整目標
        </span>
        <button
          type="button"
          onClick={() => adjustTarget(1)}
          disabled={adjusting || goal.target >= 14}
          className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-gray-200 text-lg font-bold text-gray-500 transition-colors hover:bg-gray-50 hover:border-gray-300 disabled:opacity-30 shadow-[2px_2px_0_0_rgba(0,0,0,0.1)] active:shadow-[1px_1px_0_0_rgba(0,0,0,0.1)] active:translate-x-[1px] active:translate-y-[1px]"
          aria-label="增加目標"
        >
          +
        </button>
      </div>
    </div>
  );
}

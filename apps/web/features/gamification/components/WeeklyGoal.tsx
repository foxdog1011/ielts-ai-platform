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
      <div className="animate-pulse text-sm text-zinc-400 dark:text-zinc-500">
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
        "rounded-xl border px-4 py-4 transition-all duration-300",
        isComplete
          ? "border-green-300 bg-green-50 dark:border-green-600 dark:bg-green-900/20"
          : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800",
      ].join(" ")}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {isComplete ? "🎉 週目標達成!" : "📅 本週目標"}
        </span>
        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
          {goal.weekId}
        </span>
      </div>

      {/* Progress count */}
      <div className="mb-2 text-center">
        <span className="text-3xl font-bold text-zinc-800 dark:text-zinc-100">
          {goal.completed}
        </span>
        <span className="text-lg text-zinc-400 dark:text-zinc-500">
          {" / "}
          {goal.target}
        </span>
        <div className="mt-0.5 text-[12px] text-zinc-400 dark:text-zinc-500">
          次練習
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
        <div
          className={[
            "h-full rounded-full transition-all duration-500 ease-out",
            isComplete
              ? "bg-gradient-to-r from-green-400 to-emerald-500"
              : "bg-gradient-to-r from-blue-400 to-indigo-500",
          ].join(" ")}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Adjust target buttons */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => adjustTarget(-1)}
          disabled={adjusting || goal.target <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-700"
          aria-label="減少目標"
        >
          −
        </button>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          調整目標
        </span>
        <button
          type="button"
          onClick={() => adjustTarget(1)}
          disabled={adjusting || goal.target >= 14}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-700"
          aria-label="增加目標"
        >
          +
        </button>
      </div>
    </div>
  );
}

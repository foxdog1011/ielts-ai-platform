// features/gamification/weekly-goals.ts
//
// Weekly Goals service. Users set weekly practice targets and track progress.
// Inspired by Strava's weekly goals — builds consistency habits.

import { kvGetJSON, kvSetJSON } from "@/shared/infrastructure/kv";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface WeeklyGoal {
  readonly target: number;
  readonly completed: number;
  readonly weekId: string; // e.g. "2026-W15"
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function kvKey(userId: string, weekId: string): string {
  return `weekly:${userId}:${weekId}`;
}

/** Returns ISO week ID, e.g. "2026-W15". */
export function getCurrentWeekId(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor(
    (now.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24),
  );
  const weekNumber = Math.ceil((dayOfYear + jan1.getDay() + 1) / 7);
  const paddedWeek = String(weekNumber).padStart(2, "0");
  return `${now.getFullYear()}-W${paddedWeek}`;
}

function defaultGoal(weekId: string): WeeklyGoal {
  return { target: 5, completed: 0, weekId };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function getWeeklyGoal(userId: string): Promise<WeeklyGoal> {
  const weekId = getCurrentWeekId();
  const data = await kvGetJSON<WeeklyGoal>(kvKey(userId, weekId));
  return data ?? defaultGoal(weekId);
}

export async function setWeeklyGoal(
  userId: string,
  target: number,
): Promise<WeeklyGoal> {
  const clampedTarget = Math.max(1, Math.min(14, Math.round(target)));
  const weekId = getCurrentWeekId();
  const existing = await kvGetJSON<WeeklyGoal>(kvKey(userId, weekId));

  const updated: WeeklyGoal = {
    target: clampedTarget,
    completed: existing?.completed ?? 0,
    weekId,
  };

  await kvSetJSON(kvKey(userId, weekId), updated);
  return updated;
}

export async function recordWeeklyProgress(
  userId: string,
): Promise<WeeklyGoal> {
  const weekId = getCurrentWeekId();
  const existing = await kvGetJSON<WeeklyGoal>(kvKey(userId, weekId));
  const current = existing ?? defaultGoal(weekId);

  const updated: WeeklyGoal = {
    ...current,
    completed: current.completed + 1,
  };

  await kvSetJSON(kvKey(userId, weekId), updated);
  return updated;
}

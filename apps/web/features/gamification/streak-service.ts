// features/gamification/streak-service.ts
//
// Streak tracking service. Stores per-user streak data in KV.
// Streak logic:
//   - Practiced today       -> no change
//   - Practiced yesterday   -> increment current streak
//   - Gap > 1 day, no freeze -> reset to 1
//   - Gap > 1 day, has freeze -> consume freeze, keep streak

import { kvGetJSON, kvSetJSON } from "@/shared/infrastructure/kv";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface StreakData {
  readonly current: number;
  readonly longest: number;
  readonly lastDate: string; // ISO date string "YYYY-MM-DD"
  readonly freezes: number;
}

export interface StreakInfo {
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly lastPracticeDate: string;
  readonly streakFreezes: number;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function kvKey(userId: string): string {
  return `streak:${userId}`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Number of calendar days between two ISO date strings. */
function daysBetween(a: string, b: string): number {
  const msA = new Date(a + "T00:00:00Z").getTime();
  const msB = new Date(b + "T00:00:00Z").getTime();
  return Math.round(Math.abs(msB - msA) / (1000 * 60 * 60 * 24));
}

function defaultStreak(): StreakData {
  return { current: 0, longest: 0, lastDate: "", freezes: 0 };
}

function toInfo(data: StreakData): StreakInfo {
  return {
    currentStreak: data.current,
    longestStreak: data.longest,
    lastPracticeDate: data.lastDate,
    streakFreezes: data.freezes,
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function getStreak(userId: string): Promise<StreakInfo> {
  const data = (await kvGetJSON<StreakData>(kvKey(userId))) ?? defaultStreak();
  return toInfo(data);
}

export async function recordPractice(userId: string): Promise<StreakInfo> {
  const data = (await kvGetJSON<StreakData>(kvKey(userId))) ?? defaultStreak();
  const today = todayISO();

  // Already practiced today — no change
  if (data.lastDate === today) {
    return toInfo(data);
  }

  const gap = data.lastDate ? daysBetween(data.lastDate, today) : Infinity;

  let nextCurrent: number;
  let nextFreezes = data.freezes;

  if (gap === 1) {
    // Practiced yesterday — extend streak
    nextCurrent = data.current + 1;
  } else if (gap > 1 && data.freezes > 0) {
    // Gap > 1 day but has freeze — consume freeze, keep streak
    nextCurrent = data.current + 1;
    nextFreezes = data.freezes - 1;
  } else {
    // Gap > 1 day, no freeze — reset
    nextCurrent = 1;
  }

  const nextLongest = Math.max(data.longest, nextCurrent);

  const updated: StreakData = {
    current: nextCurrent,
    longest: nextLongest,
    lastDate: today,
    freezes: nextFreezes,
  };

  await kvSetJSON(kvKey(userId), updated);
  return toInfo(updated);
}

export async function useStreakFreeze(userId: string): Promise<StreakInfo> {
  const data = (await kvGetJSON<StreakData>(kvKey(userId))) ?? defaultStreak();

  if (data.freezes <= 0) {
    return toInfo(data);
  }

  const updated: StreakData = {
    ...data,
    freezes: data.freezes - 1,
  };

  await kvSetJSON(kvKey(userId), updated);
  return toInfo(updated);
}

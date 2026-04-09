// features/gamification/xp-service.ts
//
// Experience points service. Tracks XP, level, and award history.
// Level formula: level = floor(sqrt(totalXP / 100))
// XP amounts: writing = 50, speaking = 50, daily challenge = 100, perfect (>8.0) = 25 bonus

import { kvGetJSON, kvSetJSON } from "@/shared/infrastructure/kv";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface XPHistoryEntry {
  readonly amount: number;
  readonly reason: string;
  readonly ts: number; // Unix timestamp ms
}

export interface XPData {
  readonly total: number;
  readonly level: number;
  readonly history: readonly XPHistoryEntry[];
}

export interface XPInfo {
  readonly totalXP: number;
  readonly level: number;
  readonly xpToNextLevel: number;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

export const XP_AMOUNTS = {
  writing: 50,
  speaking: 50,
  dailyChallenge: 100,
  perfectScoreBonus: 25,
} as const;

/** Maximum history entries to retain in KV (prevents unbounded growth). */
const MAX_HISTORY = 200;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function kvKey(userId: string): string {
  return `xp:${userId}`;
}

function calcLevel(totalXP: number): number {
  return Math.floor(Math.sqrt(totalXP / 100));
}

function xpForLevel(level: number): number {
  return level * level * 100;
}

function defaultXP(): XPData {
  return { total: 0, level: 0, history: [] };
}

function toInfo(data: XPData): XPInfo {
  const nextLevel = data.level + 1;
  const xpNeeded = xpForLevel(nextLevel);
  return {
    totalXP: data.total,
    level: data.level,
    xpToNextLevel: Math.max(0, xpNeeded - data.total),
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function getXP(userId: string): Promise<XPInfo> {
  const data = (await kvGetJSON<XPData>(kvKey(userId))) ?? defaultXP();
  return toInfo(data);
}

export async function awardXP(
  userId: string,
  amount: number,
  reason: string,
): Promise<XPInfo> {
  const data = (await kvGetJSON<XPData>(kvKey(userId))) ?? defaultXP();

  const entry: XPHistoryEntry = { amount, reason, ts: Date.now() };
  const newTotal = data.total + amount;
  const newLevel = calcLevel(newTotal);

  // Keep only recent history to prevent KV bloat
  const trimmedHistory = [...data.history, entry].slice(-MAX_HISTORY);

  const updated: XPData = {
    total: newTotal,
    level: newLevel,
    history: trimmedHistory,
  };

  await kvSetJSON(kvKey(userId), updated);
  return toInfo(updated);
}

// features/gamification/pr-service.ts
//
// Personal Records (PR) service. Tracks personal bests per skill dimension.
// Inspired by Strava's PR system — celebrates when users beat their best scores.

import { kvGetJSON, kvSetJSON } from "@/shared/infrastructure/kv";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface PersonalRecord {
  readonly dimension: string;
  readonly value: number;
  readonly achievedAt: number; // Unix timestamp ms
  readonly type: string;
}

export interface PRData {
  readonly records: readonly PersonalRecord[];
}

export interface NewPR {
  readonly dimension: string;
  readonly value: number;
  readonly previousBest: number | null;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function kvKey(userId: string): string {
  return `pr:${userId}`;
}

function defaultPRData(): PRData {
  return { records: [] };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function getPersonalRecords(userId: string): Promise<PRData> {
  const data = await kvGetJSON<PRData>(kvKey(userId));
  return data ?? defaultPRData();
}

export async function checkAndUpdatePR(
  userId: string,
  type: "writing" | "speaking",
  scores: Record<string, number>,
): Promise<readonly NewPR[]> {
  const data = await kvGetJSON<PRData>(kvKey(userId)) ?? defaultPRData();
  const now = Date.now();

  const existingMap = new Map<string, PersonalRecord>();
  for (const r of data.records) {
    const key = `${r.type}:${r.dimension}`;
    existingMap.set(key, r);
  }

  const newPRs: NewPR[] = [];
  const updatedRecords = [...data.records];

  for (const [dimension, value] of Object.entries(scores)) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      continue;
    }

    const mapKey = `${type}:${dimension}`;
    const existing = existingMap.get(mapKey);

    if (!existing || value > existing.value) {
      const newRecord: PersonalRecord = {
        dimension,
        value,
        achievedAt: now,
        type,
      };

      newPRs.push({
        dimension,
        value,
        previousBest: existing?.value ?? null,
      });

      // Replace existing or append new
      const idx = updatedRecords.findIndex(
        (r) => r.type === type && r.dimension === dimension,
      );
      if (idx >= 0) {
        updatedRecords[idx] = newRecord;
      } else {
        updatedRecords.push(newRecord);
      }
    }
  }

  if (newPRs.length > 0) {
    await kvSetJSON(kvKey(userId), { records: updatedRecords });
  }

  return newPRs;
}

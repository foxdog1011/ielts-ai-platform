// features/activity/activity-service.ts
//
// Service for recording and retrieving anonymized practice activity.
// Powers the Strava-style "everyone is practicing" feed.

import { kvListPushAndTrim, kvListTailJSON } from "@/shared/infrastructure/kv";
import type { ActivityItem, ActivityInput } from "@/features/activity/types";

const FEED_KEY = "activity:feed";
const MAX_FEED_SIZE = 100;
const DEFAULT_LIMIT = 20;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Create a deterministic anonymized display name from a userId. */
export function anonymizeUserId(userId: string): string {
  // Simple hash: sum char codes and convert to base-36 for a short string
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(hash).toString(36).slice(0, 6).padEnd(6, "0");
  return `User_${hex}`;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** Record a new activity item to the global feed. */
export async function recordActivity(input: ActivityInput): Promise<void> {
  const item: ActivityItem = {
    ...input,
    id: generateId(),
  };
  await kvListPushAndTrim(FEED_KEY, item, MAX_FEED_SIZE);
}

/** Get the most recent N activity items (newest last in storage, reversed for display). */
export async function getRecentActivity(limit: number = DEFAULT_LIMIT): Promise<readonly ActivityItem[]> {
  const clamped = Math.max(1, Math.min(limit, MAX_FEED_SIZE));
  const items = await kvListTailJSON<ActivityItem>(FEED_KEY, clamped);
  // Reverse so newest is first for display
  return [...items].reverse();
}

// features/gamification/daily-challenge.ts
//
// Deterministic daily challenge based on date.
// Uses a seeded hash to pick a prompt from the prompt store.
// Tracks completion per user per day in KV.

import { kvGetJSON, kvSetJSON } from "@/shared/infrastructure/kv";
import { listPrompts } from "@/features/prompts/prompt-store";
import type { PromptItem } from "@/features/prompts/prompt-store";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface DailyChallenge {
  readonly date: string; // "YYYY-MM-DD"
  readonly prompt: string;
  readonly type: "writing" | "speaking";
  readonly completed: boolean;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function completionKey(date: string, userId: string): string {
  return `daily:${date}:${userId}`;
}

/**
 * Simple deterministic hash for seeding prompt selection by date.
 * Not cryptographic — just needs to be consistent for the same input.
 */
function dateHash(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const ch = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash);
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function getDailyChallenge(userId: string): Promise<DailyChallenge> {
  const date = todayISO();
  const hash = dateHash(date);

  // Fetch prompts from both types, pick one based on date hash
  const [writingPrompts, speakingPrompts] = await Promise.all([
    listPrompts({ type: "writing" }).catch(() => [] as PromptItem[]),
    listPrompts({ type: "speaking" }).catch(() => [] as PromptItem[]),
  ]);

  const allPrompts = [...writingPrompts, ...speakingPrompts];

  // Fallback if no prompts exist
  if (allPrompts.length === 0) {
    const completed = await isCompleted(date, userId);
    return {
      date,
      prompt:
        "Some people believe that universities should focus on providing academic skills. Others think universities should prepare students for employment. Discuss both views and give your opinion.",
      type: "writing",
      completed,
    };
  }

  const idx = hash % allPrompts.length;
  const selected = allPrompts[idx];

  // Determine type from the selected prompt
  const isWriting = writingPrompts.includes(selected);
  const type = isWriting ? "writing" : "speaking";

  const completed = await isCompleted(date, userId);

  return {
    date,
    prompt: selected.prompt,
    type,
    completed,
  };
}

export async function markDailyCompleted(userId: string): Promise<void> {
  const date = todayISO();
  await kvSetJSON(completionKey(date, userId), true);
}

async function isCompleted(date: string, userId: string): Promise<boolean> {
  const val = await kvGetJSON<boolean>(completionKey(date, userId));
  return val === true;
}

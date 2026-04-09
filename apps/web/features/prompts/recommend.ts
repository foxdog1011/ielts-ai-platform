// features/prompts/recommend.ts
//
// Smart prompt recommendation engine.
//
// Strategy (in priority order):
//   1. Prefer prompts the user has never attempted.
//   2. Among attempted prompts, prefer topics where the user scored lowest.
//   3. Fallback: pick from the least-used prompts globally.

import { unstable_noStore as noStore } from "next/cache";
import {
  listPrompts,
  getPromptUsage,
  type PromptItem,
  type PromptType,
} from "./prompt-store";
import { listHistory } from "@/features/history";
import type { HistoryRecord } from "@/shared/domain/types";
import { TOPIC_CATEGORIES, type TopicCategory } from "./topic-taxonomy";

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

/** Extract topic tags from a history record (best-effort). */
function tagsFromRecord(rec: HistoryRecord): string[] {
  // History records may not carry topic tags directly; fall back to empty.
  const raw = (rec as Record<string, unknown>).topicTags;
  if (Array.isArray(raw)) return raw.map((t) => String(t).toLowerCase());
  return [];
}

/** Compute average band score from a record, or null if unavailable. */
function avgBand(rec: HistoryRecord): number | null {
  const band = rec.band;
  if (!band || typeof band !== "object") return null;
  const values = Object.values(band).filter(
    (v): v is number => typeof v === "number",
  );
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Build a map: topicCategory -> average score across all history records
 * that mention that topic. Lower = weaker area.
 */
function buildTopicScoreMap(
  records: readonly HistoryRecord[],
): Map<string, { total: number; count: number }> {
  const map = new Map<string, { total: number; count: number }>();

  for (const rec of records) {
    const score = avgBand(rec);
    if (score === null) continue;

    const tags = tagsFromRecord(rec);
    // Also match prompt text against known topic categories
    const promptLower = String(rec.prompt ?? "").toLowerCase();
    const matchedTopics = new Set<string>(tags);

    for (const cat of TOPIC_CATEGORIES) {
      if (promptLower.includes(cat)) matchedTopics.add(cat);
    }

    for (const topic of matchedTopics) {
      const prev = map.get(topic) ?? { total: 0, count: 0 };
      map.set(topic, { total: prev.total + score, count: prev.count + 1 });
    }
  }

  return map;
}

/**
 * Score a prompt for recommendation.
 * Lower score = should be recommended sooner.
 */
function computeRecommendationScore(
  prompt: PromptItem,
  usedCount: number,
  weakTopics: ReadonlySet<string>,
): number {
  // Base: number of times used (prefer unused prompts)
  let score = usedCount * 100;

  // Bonus for covering weak topics (subtract to prioritise)
  const matchCount = prompt.topicTags.filter((t) =>
    weakTopics.has(t.toLowerCase()),
  ).length;
  score -= matchCount * 50;

  return score;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Return recommended prompts for a user, sorted by relevance.
 *
 * @param _userId - Reserved for future per-user KV storage; currently
 *   history is global (single-user mode).
 * @param count   - How many prompts to return (default 5).
 * @param opts    - Optional filter by type.
 */
export async function getRecommendedPrompts(
  _userId: string,
  count = 5,
  opts?: { type?: PromptType },
): Promise<PromptItem[]> {
  noStore();

  // 1. Fetch all prompts and recent history in parallel.
  const [allPrompts, history] = await Promise.all([
    listPrompts({ type: opts?.type, limit: 200 }),
    listHistory({ limit: 200 }),
  ]);

  if (allPrompts.length === 0) return [];

  // 2. Build weak-topic set from history.
  const topicScoreMap = buildTopicScoreMap(history);
  const averageScores: Array<{ topic: string; avg: number }> = [];
  for (const [topic, { total, count: cnt }] of topicScoreMap) {
    averageScores.push({ topic, avg: total / cnt });
  }
  averageScores.sort((a, b) => a.avg - b.avg);

  // Consider the bottom third of scored topics as "weak".
  const weakCount = Math.max(1, Math.ceil(averageScores.length / 3));
  const weakTopics = new Set(
    averageScores.slice(0, weakCount).map((e) => e.topic),
  );

  // 3. Fetch usage stats for all candidate prompts.
  const usageEntries = await Promise.all(
    allPrompts.map(async (p) => {
      const usage = await getPromptUsage(p.id);
      return { prompt: p, usedCount: usage.usedCount };
    }),
  );

  // 4. Score and sort.
  const scored = usageEntries.map(({ prompt, usedCount }) => ({
    prompt,
    score: computeRecommendationScore(prompt, usedCount, weakTopics),
  }));

  scored.sort((a, b) => a.score - b.score);

  return scored.slice(0, count).map((s) => s.prompt);
}

// features/leaderboard/leaderboard-service.ts
//
// Manages per-type leaderboards stored as sorted JSON arrays in KV.
// Each type ("writing" | "speaking") keeps up to 50 entries sorted by bestBand desc.

import { kvGetJSON, kvSetJSON } from "@/shared/infrastructure/kv";

const MAX_ENTRIES = 50;

export interface LeaderboardEntry {
  readonly userId: string;
  readonly displayName: string;
  readonly bestBand: number;
  readonly practiceCount: number;
  readonly lastActiveAt: string;
}

type LeaderboardType = "writing" | "speaking";

function kvKey(type: LeaderboardType): string {
  return `leaderboard:${type}`;
}

async function loadBoard(type: LeaderboardType): Promise<readonly LeaderboardEntry[]> {
  return (await kvGetJSON<LeaderboardEntry[]>(kvKey(type))) ?? [];
}

function upsertEntry(
  board: readonly LeaderboardEntry[],
  userId: string,
  displayName: string,
  band: number,
): readonly LeaderboardEntry[] {
  const now = new Date().toISOString();
  const existing = board.find((e) => e.userId === userId);

  const updated: LeaderboardEntry = existing
    ? {
        ...existing,
        displayName,
        bestBand: Math.max(existing.bestBand, band),
        practiceCount: existing.practiceCount + 1,
        lastActiveAt: now,
      }
    : { userId, displayName, bestBand: band, practiceCount: 1, lastActiveAt: now };

  const filtered = board.filter((e) => e.userId !== userId);
  return [...filtered, updated]
    .sort((a, b) => b.bestBand - a.bestBand || a.lastActiveAt.localeCompare(b.lastActiveAt))
    .slice(0, MAX_ENTRIES);
}

export async function updateLeaderboard(
  userId: string,
  displayName: string,
  type: LeaderboardType,
  band: number,
): Promise<void> {
  const board = await loadBoard(type);
  const next = upsertEntry(board, userId, displayName, band);
  await kvSetJSON(kvKey(type), next);
}

export async function getLeaderboard(
  type: "writing" | "speaking" | "all",
  limit = 50,
): Promise<readonly LeaderboardEntry[]> {
  if (type !== "all") {
    const board = await loadBoard(type);
    return board.slice(0, limit);
  }

  const [writing, speaking] = await Promise.all([loadBoard("writing"), loadBoard("speaking")]);

  const merged = new Map<string, LeaderboardEntry>();
  for (const entry of [...writing, ...speaking]) {
    const prev = merged.get(entry.userId);
    if (!prev) {
      merged.set(entry.userId, entry);
    } else {
      merged.set(entry.userId, {
        ...prev,
        bestBand: Math.max(prev.bestBand, entry.bestBand),
        practiceCount: prev.practiceCount + entry.practiceCount,
        lastActiveAt:
          prev.lastActiveAt > entry.lastActiveAt ? prev.lastActiveAt : entry.lastActiveAt,
      });
    }
  }

  return [...merged.values()]
    .sort((a, b) => b.bestBand - a.bestBand || a.lastActiveAt.localeCompare(b.lastActiveAt))
    .slice(0, limit);
}

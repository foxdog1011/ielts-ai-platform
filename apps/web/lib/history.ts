// apps/web/lib/history.ts
// Delegates to shared/domain/types.ts for type definitions.
// Uses shared/utils/time.ts for toEpochMs.

import { unstable_noStore as noStore } from "next/cache";
import { listScores, saveScore, type ScorePayload } from "@/lib/kv";
import { toEpochMs as _toEpochMs } from "@/shared/utils/time";

// Re-export domain types from shared layer
export type {
  WritingBand,
  SpeakingBand,
  BaseRecord,
  WritingRecord,
  SpeakingRecord,
  HistoryRecord,
} from "@/shared/domain/types";
export type { DiagSummary, PlanSnapshot } from "@/shared/domain/types";

import type { HistoryRecord } from "@/shared/domain/types";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const TAKE_CAP = 200;

function toEpochMs(rec: Partial<HistoryRecord>): number {
  const result = _toEpochMs(rec as { ts?: number; createdAt?: string });
  // history.ts originally returned Date.now() as fallback (unlike shared which returns 0)
  return result || Date.now();
}

/** 把「舊→新」反轉成「新→舊」，再做 offset/limit 切片 */
function pageNewestFirst<T>(itemsOldToNew: T[], limit: number, offset: number): T[] {
  const newestFirst = [...itemsOldToNew].reverse();
  return newestFirst.slice(offset, offset + limit);
}

/** 寫入一筆歷史（委派給 saveScore） */
export async function saveHistory(rec: HistoryRecord): Promise<HistoryRecord> {
  noStore();
  const { type, ...payload } = rec as any;
  const out = await saveScore(type, payload as Omit<ScorePayload, "createdAt">);
  return { type, ...(out as any) };
}

/** 讀取歷史（最新在前） */
export async function listHistory(opts: {
  type?: "writing" | "speaking";
  limit?: number;
  offset?: number;
} = {}): Promise<HistoryRecord[]> {
  noStore();
  const type = opts.type;
  const limit = clamp(Number(opts.limit ?? 50), 1, 100);
  const offset = Math.max(0, Number(opts.offset ?? 0));
  const take = clamp(limit + offset, 1, TAKE_CAP);

  if (type === "speaking" || type === "writing") {
    const base = (await listScores(type, take)) as unknown[]; // 舊→新
    const page = pageNewestFirst(base, limit, offset);
    return page.map((x: unknown) => {
      const item = x as Record<string, unknown>;
      return { type, ...item } as HistoryRecord;
    });
  }

  // 同時取兩類，最後合併
  type KVItem = Record<string, unknown>;

  const [spkRaw, wriRaw] = (await Promise.all([
    listScores("speaking", take),
    listScores("writing", take),
  ])) as [unknown[], unknown[]];

  const spk = (spkRaw as unknown[]).map((x: unknown) => x as KVItem);
  const wri = (wriRaw as unknown[]).map((x: unknown) => x as KVItem);

  const all: HistoryRecord[] = [
    ...(spk.map((x: KVItem) => ({ type: "speaking" as const, ...x })) as any),
    ...(wri.map((x: KVItem) => ({ type: "writing" as const, ...x })) as any),
  ];

  all.sort((a, b) => toEpochMs(b) - toEpochMs(a)); // 新→舊
  return all.slice(offset, offset + limit);
}

/** 取最新 N 筆（不分 type） */
export async function latestHistory(limit = 10): Promise<HistoryRecord[]> {
  return listHistory({ limit, offset: 0 });
}

/** 取某一類型的最新一筆（方便頁面使用） */
export async function latestOfType(type: "writing" | "speaking") {
  const [x] = await listHistory({ type, limit: 1 });
  return x;
}

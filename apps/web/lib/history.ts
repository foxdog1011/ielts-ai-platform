// apps/web/lib/history.ts
// 只依賴 lib/kv.ts 的 listScores / saveScore / ScorePayload

import { unstable_noStore as noStore } from "next/cache";
import { listScores, saveScore, type ScorePayload } from "@/lib/kv";

export type WritingBand = {
  overall?: number;
  taskResponse?: number;
  coherence?: number;
  lexical?: number;
  grammar?: number;
};

export type SpeakingBand = {
  overall?: number;
  content?: number;
  grammar?: number;
  vocab?: number;
  fluency?: number;
  pronunciation?: number;
};

export type BaseRecord = {
  taskId: string;
  prompt?: string;
  durationSec?: number;
  ts?: number;
  createdAt?: string;
};

export type WritingRecord = BaseRecord & {
  type: "writing";
  words?: number;
  band?: WritingBand | null;
};

export type SpeakingRecord = BaseRecord & {
  type: "speaking";
  band?: SpeakingBand | null;
  speakingFeatures?: Record<string, number | string | boolean>;
};

export type HistoryRecord = WritingRecord | SpeakingRecord;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const TAKE_CAP = 200;

function toEpochMs(rec: Partial<HistoryRecord>): number {
  if (typeof rec.ts === "number" && Number.isFinite(rec.ts)) return rec.ts;
  if (rec.createdAt) {
    const t = Date.parse(rec.createdAt);
    if (!Number.isNaN(t)) return t;
  }
  return Date.now();
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

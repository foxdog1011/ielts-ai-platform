// apps/web/app/lib/history.ts
import { kvListLen, kvListRangeJSON, kvListPushJSON } from "./kv";

const NS = process.env.HISTORY_NAMESPACE || "ielts";
const USER = "anon"; // 之後接入登入時改成 userId

export type BandScores = {
  overall?: number;
  taskResponse?: number;
  coherence?: number;
  lexical?: number;
  grammar?: number;
};

export type SpeakingScores = {
  overall?: number;       // 你也可以只計算 content/speech，overall 可選
  content?: number;       // 內容
  speech?: number;        // 語音（發音/流暢）
};

export type WritingHistory = {
  id: string;
  ts: number;
  type: "writing";
  taskId: string;
  prompt: string;
  words: number;
  durationSec: number;
  band?: BandScores | null;
};

export type SpeakingHistory = {
  id: string;
  ts: number;
  type: "speaking";
  taskId: string;
  prompt: string;
  durationSec: number;
  band?: SpeakingScores | null;
};

export type AnyHistory = WritingHistory | SpeakingHistory;

function listKey() {
  return `${NS}:history:${USER}`;
}
function rid() {
  return Math.random().toString(36).slice(2, 10);
}

/** 寫入一筆歷史（尾端 append） */
export async function saveHistory(row: Omit<AnyHistory, "id" | "ts"> & Partial<Pick<AnyHistory, "ts">>) {
  const rec: AnyHistory = {
    id: rid(),
    ts: row.ts ?? Date.now(),
    ...(row as any),
  };
  await kvListPushJSON(listKey(), rec);
  return rec;
}

/** 分頁查詢（新→舊） */
export async function listHistory(opts: { type?: "writing" | "speaking"; limit?: number; offset?: number } = {}) {
  const { type, limit = 50, offset = 0 } = opts;
  const len = await kvListLen(listKey());
  if (!len || len <= 0) return [];
  const end = len - 1 - offset;
  const start = Math.max(0, end - (limit - 1));
  const rows = await kvListRangeJSON<AnyHistory>(listKey(), start, end);
  return rows
    .filter((r) => (type ? r.type === type : true))
    .sort((a, b) => b.ts - a.ts);
}

/** 取各類型最近一筆（無則回 null） */
export async function latestHistory(type: "writing" | "speaking") {
  const got = await listHistory({ type, limit: 1, offset: 0 });
  return got[0] ?? null;
}

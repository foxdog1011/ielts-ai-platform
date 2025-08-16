// apps/web/lib/history.ts
// 紀錄練習歷史：list / latest / save（走檔案型 KV）
// 重要：不再使用 kvListLen，統一用 kvListRangeJSON 後端做分頁。

import { kvListPushJSON, kvListRangeJSON } from "./kv";

type WritingBand = {
  overall?: number;
  taskResponse?: number;
  coherence?: number;
  lexical?: number;
  grammar?: number;
};

type SpeakingBand = {
  overall?: number;
  content?: number;
  speech?: number;
};

export type WritingHistoryInput = {
  type: "writing";
  taskId: string;
  prompt: string;
  durationSec: number;
  words?: number;
  band?: WritingBand | null;
  ts?: number; // 可覆寫時間戳（預設 Date.now()）
};

export type SpeakingHistoryInput = {
  type: "speaking";
  taskId: string;
  prompt: string;
  durationSec: number;
  band?: SpeakingBand | null;
  ts?: number; // 可覆寫時間戳（預設 Date.now()）
};

export type HistoryInput = WritingHistoryInput | SpeakingHistoryInput;

export type HistoryRowBase = {
  id: string;
  ts: number;
  type: "writing" | "speaking";
  taskId: string;
  prompt: string;
  durationSec: number;
};

export type WritingHistoryRow = HistoryRowBase & {
  type: "writing";
  words?: number;
  band?: WritingBand | null;
};

export type SpeakingHistoryRow = HistoryRowBase & {
  type: "speaking";
  band?: SpeakingBand | null;
};

export type HistoryRow = WritingHistoryRow | SpeakingHistoryRow;

function listKey() {
  return "history:list:v1";
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export async function saveHistory(input: HistoryInput): Promise<HistoryRow> {
  const now = typeof input.ts === "number" ? input.ts : Date.now();
  const id = makeId();

  const row: HistoryRow = {
    id,
    ts: now,
    type: input.type,
    taskId: input.taskId,
    prompt: input.prompt,
    durationSec: input.durationSec,
    ...(input.type === "writing"
      ? {
          words: input.words,
          band: input.band ?? null,
        }
      : {
          band: input.band ?? null,
        }),
  } as HistoryRow;

  await kvListPushJSON(listKey(), row);
  return row;
}

export async function listHistory(opts: {
  type?: "writing" | "speaking";
  limit?: number;
  offset?: number;
} = {}): Promise<HistoryRow[]> {
  const { type, limit = 50, offset = 0 } = opts;

  // 取完整清單（DEV 數量很小，OK；正式可換成後端分頁）
  const all = (await kvListRangeJSON(listKey())) as HistoryRow[];

  // 依時間倒序（新→舊）
  const sorted = [...all].sort((a: HistoryRow, b: HistoryRow) => (b.ts || 0) - (a.ts || 0));

  const filtered = type ? sorted.filter((r) => r.type === type) : sorted;

  const start = Math.max(0, offset);
  const end = Math.max(start, start + (limit || 0));
  return filtered.slice(start, end);
}

export async function latestHistory(
  type?: "writing" | "speaking"
): Promise<HistoryRow | undefined> {
  const rows = await listHistory({ type, limit: 1, offset: 0 });
  return rows[0];
}

import { kvListLen, kvListPushJSON, kvListRangeJSON } from "./kv";

const NS = process.env.HISTORY_NAMESPACE || "ielts";
const USER = "anon"; // 開發期用匿名

export type WritingHistory = {
  id: string;
  type: "writing";
  taskId: string;
  ts: number;
  band: { overall?: number; taskResponse?: number; coherence?: number; lexical?: number; grammar?: number };
  words?: number;
  wpm?: number;
  targetWords?: number;
};

export type SpeakingHistory = {
  id: string;
  type: "speaking";
  taskId: string;
  ts: number;
  bandContent?: { overall?: number; taskResponse?: number; coherence?: number; vocabulary?: number; grammar?: number };
  bandSpeech?: { overall?: number; pronunciation?: number; fluency?: number };
  metrics?: { durationSec: number; wpm: number; pauseRate: number | null; avgPauseSec: number | null };
};

export type AnyHistory = WritingHistory | SpeakingHistory;

function key(type: "writing" | "speaking") {
  return `${NS}:history:${USER}:${type}`;
}
function rid() {
  return Math.random().toString(36).slice(2, 10);
}

export async function saveWriting(h: Omit<WritingHistory, "id" | "ts" | "type">) {
  const rec: WritingHistory = { id: rid(), ts: Date.now(), type: "writing", ...h };
  await kvListPushJSON(key("writing"), rec);
  return rec;
}

export async function saveSpeaking(h: Omit<SpeakingHistory, "id" | "ts" | "type">) {
  const rec: SpeakingHistory = { id: rid(), ts: Date.now(), type: "speaking", ...h };
  await kvListPushJSON(key("speaking"), rec);
  return rec;
}

export async function getHistory(type: "writing" | "speaking", limit = 20): Promise<AnyHistory[]> {
  const len = await kvListLen(key(type));
  if (len === 0) return [];
  const start = Math.max(0, len - limit);
  const rows = await kvListRangeJSON<AnyHistory>(key(type), start, len - 1);
  return rows;
}

// 這行保證回傳型別精確，而不是 AnyHistory
export async function getLatestSummaries(): Promise<{
  writing: WritingHistory | null;
  speaking: SpeakingHistory | null;
}> {
  const [w, s] = await Promise.all([getHistory("writing", 1), getHistory("speaking", 1)]);
  return {
    writing: (w[0] as WritingHistory) || null,
    speaking: (s[0] as SpeakingHistory) || null,
  };
}


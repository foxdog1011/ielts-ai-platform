// apps/web/app/lib/promptStore.ts
import {
  kvListLen,
  kvListRangeJSON,
  kvListPushJSON,
  kvGetJSON,
  kvSetJSON,
} from "./kv";
import crypto from "crypto";

const NS = process.env.HISTORY_NAMESPACE || "ielts";
const USER = "anon"; // 先用匿名；之後接 auth 再換成 userId

export type PromptType = "writing" | "speaking";
export type WritingPart = "task1-ac" | "task1-gt" | "task2";
export type SpeakingPart = "part1" | "part2" | "part3";

export type PromptFlags = {
  fav?: boolean;       // 收藏
  skip?: boolean;      // 略過
  usedCount?: number;  // 使用次數（未來可加）
  lastUsedTs?: number; // 最後使用時間（未來可加）
};

export type PromptItem = {
  id: string;
  type: PromptType;
  part: WritingPart | SpeakingPart;
  topicTags: string[];
  level?: "5.0-6.0" | "6.0-7.0" | "7.0-8.0";
  prompt: string;
  followup?: string[];
  source: "ai-gen" | "seed" | "user";
  hash: string;
  ts: number;
};

function listKey() {
  return `${NS}:promptbank:${USER}`;
}
function flagKey(id: string) {
  return `${NS}:promptflag:${USER}:${id}`;
}
function rid() {
  return Math.random().toString(36).slice(2, 10);
}
function makeHash(s: string) {
  return crypto.createHash("sha1").update(s).digest("hex");
}

/** 批次儲存（近段去重） */
export async function savePromptsUniq(
  items: Omit<PromptItem, "id" | "ts" | "hash">[]
) {
  const len = await kvListLen(listKey());
  const window = Math.min(2000, len || 0);
  const existing = await kvListRangeJSON<PromptItem>(
    listKey(),
    Math.max(0, len - window),
    Math.max(0, len - 1)
  );
  const seen = new Set(existing.map((p) => p.hash));

  const out: PromptItem[] = [];
  for (const it of items) {
    const hash = makeHash(
      `${it.type}|${it.part}|${(it.topicTags || []).join(",")}|${it.prompt}`
    );
    if (seen.has(hash)) continue;
    const row: PromptItem = { id: rid(), ts: Date.now(), hash, ...it };
    await kvListPushJSON(listKey(), row);
    seen.add(hash);
    out.push(row);
  }
  return out;
}

/** 分頁查詢（依 type/part/topic/level 過濾） */
export type QueryOpts = {
  type?: PromptType;
  part?: WritingPart | SpeakingPart;
  topic?: string;
  level?: PromptItem["level"];
  limit?: number;
  offset?: number;
};

export async function listPrompts(opts: QueryOpts = {}) {
  const { limit = 50, offset = 0 } = opts;
  const len = await kvListLen(listKey());
  if (!len || len <= 0) return [];

  const end = len - 1 - offset;
  const start = Math.max(0, end - (limit - 1));
  const rows = await kvListRangeJSON<PromptItem>(listKey(), start, end);

  return rows
    .filter((r) => (opts.type ? r.type === opts.type : true))
    .filter((r) => (opts.part ? r.part === opts.part : true))
    .filter((r) => (opts.level ? r.level === opts.level : true))
    .filter((r) =>
      opts.topic ? (r.topicTags || []).some((t) => t.includes(opts.topic!)) : true
    )
    .sort((a, b) => b.ts - a.ts);
}

/* ---------------- Flags：單筆存取與批次併回 ---------------- */

export async function getPromptFlags(id: string): Promise<PromptFlags> {
  return (await kvGetJSON<PromptFlags>(flagKey(id))) || {};
}

export async function setPromptFlags(
  id: string,
  patch: Partial<PromptFlags>
): Promise<PromptFlags> {
  const cur = (await kvGetJSON<PromptFlags>(flagKey(id))) || {};
  const next: PromptFlags = { ...cur, ...patch };
  await kvSetJSON(flagKey(id), next);
  return next;
}

/** 將 flags 併回到題目列（列表用） */
export async function enrichWithFlags<T extends { id: string }>(rows: T[]) {
  const out: (T & { flags: PromptFlags })[] = [];
  for (const r of rows) {
    const flags = await getPromptFlags(r.id);
    out.push({ ...r, flags });
  }
  return out;
}

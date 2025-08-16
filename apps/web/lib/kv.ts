// apps/web/lib/kv.ts
import { unstable_noStore as noStore } from "next/cache";

/** 是否有設定 Vercel KV REST 環境變數 */
const HAS_KV = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

let kvClient: any = null;

// 動態載入（避免 edge bundle 警告）
async function getKV() {
  if (!HAS_KV) return null;
  if (kvClient) return kvClient;
  const mod = await import("@vercel/kv");
  // SDK 的 default 匯出是一個 proxy client
  kvClient = mod.default;
  return kvClient;
}

/* ------------------------------------------------------------------ */
/* In-memory fallback（本機或沒設 KV 時）                              */
/* ------------------------------------------------------------------ */

const mem = new Map<string, string>();          // 一律存 JSON 字串
const memLists = new Map<string, string[]>();   // list 存 JSON 字串
const memSets = new Map<string, Set<string>>(); // set 存 string

function memGet(key: string): string | null {
  return mem.has(key) ? (mem.get(key) as string) : null;
}
function memSet(key: string, json: string) {
  mem.set(key, json);
}
function memRpushJSON(key: string, json: string) {
  const arr = memLists.get(key) ?? [];
  arr.push(json);
  memLists.set(key, arr);
}
function memLrange(key: string, start: number, stop: number): string[] {
  const arr = memLists.get(key) ?? [];
  const n = arr.length;

  // 兼容 redis 負索引
  const norm = (i: number) => (i < 0 ? n + i : i);
  let s = norm(start);
  let e = norm(stop);

  // 邊界修正
  s = Math.max(0, Math.min(s, n - 1));
  e = Math.max(0, Math.min(e, n - 1));
  if (e < s) return [];
  return arr.slice(s, e + 1);
}
function memSadd(key: string, ...members: string[]) {
  const s = memSets.get(key) ?? new Set<string>();
  members.forEach((m) => s.add(m));
  memSets.set(key, s);
}
function memSismember(key: string, member: string) {
  const s = memSets.get(key) ?? new Set<string>();
  return s.has(member);
}

/* ------------------------------------------------------------------ */
/* 通用 JSON KV 介面（全部統一「存字串、讀字串後 JSON.parse」）        */
/* ------------------------------------------------------------------ */

export async function kvSetJSON<T>(key: string, val: T) {
  noStore();
  const json = JSON.stringify(val);
  const kv = await getKV();
  if (kv) {
    await kv.set(key, json);
  } else {
    memSet(key, json);
  }
}

export async function kvGetJSON<T>(key: string): Promise<T | null> {
  noStore();
  const kv = await getKV();
  if (kv) {
    const v = (await kv.get(key)) as unknown;
    if (v == null) return null;
    // Upstash 會回字串；但保險起見，把任何型別都轉成字串再 parse
    return JSON.parse(String(v)) as T;
  } else {
    const s = memGet(key);
    if (s == null) return null;
    return JSON.parse(s) as T;
  }
}

export async function kvListPushJSON(key: string, obj: unknown) {
  noStore();
  const json = JSON.stringify(obj);
  const kv = await getKV();
  if (kv) {
    await kv.rpush(key, json);
  } else {
    memRpushJSON(key, json);
  }
}

/** 讀取最後 take 筆（舊→新），並 JSON.parse */
export async function kvListTailJSON<T>(key: string, take: number): Promise<T[]> {
  noStore();
  const kv = await getKV();
  if (kv) {
    // Upstash 可能回字串，也可能回已反序列化的物件（極少見，但要防）
    const raw = (await kv.lrange(key, -take, -1)) as unknown[];
    return raw.map((v) => (typeof v === "string" ? (JSON.parse(v) as T) : (v as T)));
  } else {
    const raw = memLrange(key, -take, -1);
    return raw.map((s) => JSON.parse(String(s)) as T);
  }
}

export async function kvSetAdd(key: string, member: string) {
  noStore();
  const kv = await getKV();
  if (kv) {
    await kv.sadd(key, member);
  } else {
    memSadd(key, member);
  }
}

export async function kvSetHas(key: string, member: string): Promise<boolean> {
  noStore();
  const kv = await getKV();
  if (kv) {
    const ret = (await kv.sismember(key, member)) as unknown;
    // Upstash 可能回 1/0、true/false 或 "1"/"0"
    if (typeof ret === "boolean") return ret;
    if (typeof ret === "number") return ret === 1;
    if (typeof ret === "string") return ret === "1" || ret.toLowerCase() === "true";
    return Boolean(ret);
  } else {
    return memSismember(key, member);
  }
}

/* ------------------------------------------------------------------ */
/* 分數歷史（供 /api/writing, /api/speaking, lib/history.ts 使用）     */
/* ------------------------------------------------------------------ */

export type ScorePayload = {
  taskId: string;
  prompt?: string;
  durationSec?: number;
  words?: number;
  band?: any; // { overall?: number, ... }
  speakingFeatures?: Record<string, unknown>;
  ts?: number;           // 可選：外部提供（epoch ms）
  createdAt?: string;    // 寫入時自動補
};

function scoreListKey(kind: "writing" | "speaking") {
  return `scores:v1:${kind}`;
}

/** 寫入一筆（尾推），回傳含 createdAt 的物件 */
export async function saveScore(
  kind: "writing" | "speaking",
  payload: Omit<ScorePayload, "createdAt">
): Promise<ScorePayload> {
  noStore();
  const rec: ScorePayload = {
    ...payload,
    createdAt: new Date().toISOString(),
  };
  await kvListPushJSON(scoreListKey(kind), rec);
  return rec;
}

/** 讀取最後 take 筆（舊→新） */
export async function listScores(
  kind: "writing" | "speaking",
  take = 200
): Promise<ScorePayload[]> {
  noStore();
  return kvListTailJSON<ScorePayload>(scoreListKey(kind), take);
}

/* ------------------------------------------------------------------ */
/* 健康資訊                                                            */
/* ------------------------------------------------------------------ */
export function kvDiag() {
  return {
    provider: HAS_KV ? "vercel-kv" : "memory",
    hasUrl: !!process.env.KV_REST_API_URL,
    hasToken: !!process.env.KV_REST_API_TOKEN,
    ok: true,
  };
}

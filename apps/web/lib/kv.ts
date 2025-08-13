import type { Redis } from "@upstash/redis";

let redis: Redis | null = null;

// 沒環境變數就回傳 null → 自動用記憶體暫存
async function getRedis(): Promise<Redis | null> {
  if (redis !== null) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redis = null;
    return null;
  }
  const { Redis } = await import("@upstash/redis");
  redis = new Redis({ url, token });
  return redis;
}

// 簡單記憶體 List 暫存（重啟會清空）
const mem = new Map<string, string[]>();

export async function kvListPushJSON(key: string, value: unknown) {
  const r = await getRedis();
  const json = JSON.stringify(value);
  if (r) {
    await r.rpush(key, json);
  } else {
    const arr = mem.get(key) || [];
    arr.push(json);
    mem.set(key, arr);
  }
}

export async function kvListRangeJSON<T = unknown>(key: string, start = 0, end = -1): Promise<T[]> {
  const r = await getRedis();
  if (r) {
    const raws = await r.lrange<string[]>(key, start, end);
    return raws.map((s) => safeJSON<T>(s)).filter(Boolean) as T[];
  } else {
    const arr = mem.get(key) || [];
    const slice = end === -1 ? arr.slice(start) : arr.slice(start, end + 1);
    return slice.map((s) => safeJSON<T>(s)).filter(Boolean) as T[];
  }
}

export async function kvListLen(key: string): Promise<number> {
  const r = await getRedis();
  if (r) {
    // @ts-ignore upstash 有 llen
    return await r.llen(key);
  } else {
    const arr = mem.get(key) || [];
    return arr.length;
  }
}

function safeJSON<T>(s: string): T | null {
  try { return JSON.parse(s) as T; } catch { return null; }
}

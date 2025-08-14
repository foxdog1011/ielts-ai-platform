// apps/web/app/lib/kv.ts
// 簡易 in-memory KV，支援：JSON 取/存、list push/len/range
// 用 globalThis 單例，避免 HMR/多次 import 造成重複宣告

type JsonValue = any;

// 單例記憶體存放（同一個 Node 進程內共用）
const _g = globalThis as unknown as { __KV_MEM__?: Map<string, string> };
const MEM: Map<string, string> = _g.__KV_MEM__ ??= new Map<string, string>();

/** 讀字串 */
function memGet(key: string): string | undefined {
  return MEM.get(key);
}
/** 寫字串 */
function memSet(key: string, val: string): void {
  MEM.set(key, val);
}

/** 取 JSON（不存在回傳 null） */
export async function kvGetJSON<T = JsonValue>(key: string): Promise<T | null> {
  const raw = memGet(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** 存 JSON（可自行擴充 TTL；此 in-memory 版不處理 TTL） */
export async function kvSetJSON(key: string, value: JsonValue, _ttlSec?: number): Promise<void> {
  memSet(key, JSON.stringify(value));
}

/* ---------------- List API（以 JSON 陣列存放）---------------- */

/** 取得 list 長度（若不存在，回 0） */
export async function kvListLen(key: string): Promise<number> {
  const arr = (await kvGetJSON<JsonValue[]>(key)) ?? [];
  return Array.isArray(arr) ? arr.length : 0;
}

/** 取出區間（start/end 皆為含端點；若超界會自動裁切） */
export async function kvListRangeJSON<T = JsonValue>(
  key: string,
  start: number,
  end: number
): Promise<T[]> {
  const arr = (await kvGetJSON<JsonValue[]>(key)) ?? [];
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const s = Math.max(0, start);
  const e = Math.min(arr.length - 1, end);
  if (s > e) return [];
  // 以 slice 模擬 Redis LRANGE（end 為含端點，因此要 +1）
  return arr.slice(s, e + 1) as T[];
}

/** 於尾端 push 一筆 JSON */
export async function kvListPushJSON<T = JsonValue>(key: string, value: T): Promise<number> {
  const arr = (await kvGetJSON<JsonValue[]>(key)) ?? [];
  const list = Array.isArray(arr) ? arr : [];
  list.push(value);
  await kvSetJSON(key, list);
  return list.length;
}

// shared/infrastructure/kv.ts
//
// Pure KV operations — get, set, list, del.
// No business logic (saveScore, listScores removed — they belong in features/).
// Re-exports domain types for backward compatibility.

import { unstable_noStore as noStore } from "next/cache";
import type { DiagSummary, PlanSnapshot, ScorePayload } from "@/shared/domain/types";

// Re-export domain types so existing code that imported from lib/kv still compiles
// via barrel re-export in lib/kv.ts.
export type { DiagSummary, PlanSnapshot, ScorePayload };

/** Whether Vercel KV REST env vars are configured */
const HAS_KV = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

let kvClient: any = null;

async function getKV() {
  if (!HAS_KV) return null;
  if (kvClient) return kvClient;
  const mod = await import("@vercel/kv");
  kvClient = mod.default;
  return kvClient;
}

/* ------------------------------------------------------------------ */
/* In-memory fallback                                                  */
/* ------------------------------------------------------------------ */

const _g = globalThis as typeof globalThis & {
  __kv_mem__?: Map<string, string>;
  __kv_mem_lists__?: Map<string, string[]>;
  __kv_mem_sets__?: Map<string, Set<string>>;
};
if (!_g.__kv_mem__) _g.__kv_mem__ = new Map<string, string>();
if (!_g.__kv_mem_lists__) _g.__kv_mem_lists__ = new Map<string, string[]>();
if (!_g.__kv_mem_sets__) _g.__kv_mem_sets__ = new Map<string, Set<string>>();

const mem = _g.__kv_mem__;
const memLists = _g.__kv_mem_lists__;
const memSets = _g.__kv_mem_sets__;

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
  const norm = (i: number) => (i < 0 ? n + i : i);
  let s = norm(start);
  let e = norm(stop);
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
/* Generic JSON KV interface                                           */
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

export async function kvListTailJSON<T>(key: string, take: number): Promise<T[]> {
  noStore();
  const kv = await getKV();
  if (kv) {
    const raw = (await kv.lrange(key, -take, -1)) as unknown[];
    return raw.map((v) =>
      typeof v === "string" ? (JSON.parse(v) as T) : (v as T),
    );
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
    if (typeof ret === "boolean") return ret;
    if (typeof ret === "number") return ret === 1;
    if (typeof ret === "string") return ret === "1" || ret.toLowerCase() === "true";
    return Boolean(ret);
  } else {
    return memSismember(key, member);
  }
}

/* ------------------------------------------------------------------ */
/* Health info                                                         */
/* ------------------------------------------------------------------ */

export function kvDiag() {
  return {
    provider: HAS_KV ? "vercel-kv" : "memory",
    hasUrl: !!process.env.KV_REST_API_URL,
    hasToken: !!process.env.KV_REST_API_TOKEN,
    ok: true,
  };
}

// apps/web/lib/kv.ts
// 簡易檔案型 KV（dev/面試用）。正式上線再切到 @vercel/kv 或 Redis。
// 介面：kvListPushJSON / kvListRangeJSON / kvListLen

import { promises as fs } from "fs";
import path from "path";

type KVState = Record<string, any[]>;

const KV_FILE = process.env.KV_FILE || "/tmp/ielts-ai-kv.json";

async function readAll(): Promise<KVState> {
  try {
    const raw = await fs.readFile(KV_FILE, "utf8");
    return JSON.parse(raw) as KVState;
  } catch {
    return {};
  }
}

async function writeAll(db: KVState): Promise<void> {
  await fs.mkdir(path.dirname(KV_FILE), { recursive: true });
  await fs.writeFile(KV_FILE, JSON.stringify(db), "utf8");
}

export async function kvListPushJSON(key: string, value: any): Promise<number> {
  const db = await readAll();
  const arr = Array.isArray(db[key]) ? db[key] : [];
  arr.push(value);
  db[key] = arr;
  await writeAll(db);
  return arr.length;
}

export async function kvListRangeJSON(key: string): Promise<any[]> {
  const db = await readAll();
  const arr = Array.isArray(db[key]) ? db[key] : [];
  return arr;
}

export async function kvListLen(key: string): Promise<number> {
  const db = await readAll();
  const arr = Array.isArray(db[key]) ? db[key] : [];
  return arr.length;
}

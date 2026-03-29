// apps/web/app/api/notebook/route.ts
// GET  /api/notebook         — list error entries (newest first, limit 200)
// POST /api/notebook         — add one or more error entries
// DELETE /api/notebook?id=X  — remove an entry by id

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export type NotebookEntry = {
  id: string;
  ts: number;
  examType: "writing" | "speaking";
  dimension: "grammar" | "lexical" | "coherence" | "task" | "other";
  original: string;   // the erroneous phrase/sentence
  correction: string; // suggested correction
  explanation: string;
};

const KEY = "notebook:v1";

async function getAll(): Promise<NotebookEntry[]> {
  try {
    const items = await kv.lrange<NotebookEntry>(KEY, 0, 199);
    return items ?? [];
  } catch {
    const store = ((globalThis as any).__notebook_mem__ as NotebookEntry[]) ?? [];
    return store;
  }
}

async function addEntries(entries: NotebookEntry[]): Promise<void> {
  try {
    // lpush newest-first
    for (const e of entries.reverse()) {
      await kv.lpush(KEY, e);
    }
    await kv.ltrim(KEY, 0, 499); // cap at 500 entries
  } catch {
    const store: NotebookEntry[] = ((globalThis as any).__notebook_mem__ as NotebookEntry[]) ?? [];
    (globalThis as any).__notebook_mem__ = [...entries, ...store].slice(0, 500);
  }
}

async function removeEntry(id: string): Promise<void> {
  try {
    const all = await kv.lrange<NotebookEntry>(KEY, 0, -1);
    if (!all) return;
    await kv.del(KEY);
    const filtered = all.filter((e) => e?.id !== id);
    for (const e of filtered.reverse()) {
      await kv.lpush(KEY, e);
    }
  } catch {
    const store: NotebookEntry[] = ((globalThis as any).__notebook_mem__ as NotebookEntry[]) ?? [];
    (globalThis as any).__notebook_mem__ = store.filter((e) => e.id !== id);
  }
}

export async function GET() {
  const entries = await getAll();
  return NextResponse.json({ ok: true, data: entries });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const raw: Omit<NotebookEntry, "id" | "ts">[] = Array.isArray(body) ? body : [body];
    const entries: NotebookEntry[] = raw
      .filter((e) => e.original?.trim() && e.correction?.trim())
      .map((e) => ({
        id: crypto.randomUUID(),
        ts: Date.now(),
        examType: e.examType ?? "writing",
        dimension: e.dimension ?? "grammar",
        original: String(e.original).trim(),
        correction: String(e.correction).trim(),
        explanation: String(e.explanation ?? "").trim(),
      }));
    if (entries.length) await addEntries(entries);
    return NextResponse.json({ ok: true, data: { added: entries.length } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: { message: e?.message } }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: { message: "id required" } }, { status: 400 });
  await removeEntry(id);
  return NextResponse.json({ ok: true });
}

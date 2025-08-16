// apps/web/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listScores, saveScore } from "@/lib/kv";

export const runtime = "nodejs";

// -------- utils --------
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * 從「最後 take 筆（舊→新）」的陣列，切出 offset/limit（回傳新→舊）。
 */
function pageNewestFirst<T>(itemsOldToNew: T[], limit: number, offset: number): T[] {
  const newestFirst = [...itemsOldToNew].reverse(); // 新→舊
  return newestFirst.slice(offset, offset + limit);
}

// -------- GET /api/history?type=writing|speaking&limit=&offset= --------
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const typeQ = (searchParams.get("type") || "").toLowerCase();
  const limitQ = Number(searchParams.get("limit") || 50);
  const offsetQ = Number(searchParams.get("offset") || 0);

  const limit = clamp(Number.isFinite(limitQ) ? limitQ : 50, 1, 100);
  const offset = Math.max(0, Number.isFinite(offsetQ) ? offsetQ : 0);
  const take = clamp(limit + offset, 1, 200);

  // 只取單一 type
  if (typeQ === "speaking" || typeQ === "writing") {
    const base = await listScores(typeQ as "speaking" | "writing", take); // 舊→新
    const page = pageNewestFirst(base, limit, offset); // 新→舊
    return NextResponse.json({ ok: true, data: page });
  }

  // 同時回傳兩類（皆為新→舊）
  type KVItem = Record<string, unknown>;

  const [spk, wri] = await Promise.all([
    listScores("speaking", take),
    listScores("writing", take),
  ]);

  const speaking = pageNewestFirst<KVItem>(spk as KVItem[], limit, offset).map(
    (x: KVItem) => ({ type: "speaking" as const, ...x })
  );

  const writing = pageNewestFirst<KVItem>(wri as KVItem[], limit, offset).map(
    (x: KVItem) => ({ type: "writing" as const, ...x })
  );

  return NextResponse.json({ ok: true, data: { speaking, writing } });
}

// -------- POST /api/history --------
// body: { type, taskId, prompt, durationSec, ... }
const BandWriting = z
  .object({
    overall: z.number().optional(),
    taskResponse: z.number().optional(),
    coherence: z.number().optional(),
    lexical: z.number().optional(),
    grammar: z.number().optional(),
  })
  .partial();

const BandSpeaking = z
  .object({
    overall: z.number().optional(),
    content: z.number().optional(),
    grammar: z.number().optional(),
    vocab: z.number().optional(),
    fluency: z.number().optional(),
    pronunciation: z.number().optional(),
    speech: z.number().optional(), // 兼容舊欄位
  })
  .partial();

const SpeakingFeatures = z
  .record(z.string(), z.union([z.number(), z.string(), z.boolean()]))
  .optional();

const Body = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("writing"),
    taskId: z.string().min(1),
    prompt: z.string().min(1),
    durationSec: z.number().int().nonnegative(),
    words: z.number().int().nonnegative().optional(),
    band: BandWriting.nullable().optional(),
    ts: z.number().optional(), // epoch ms（可選）
  }),
  z.object({
    type: z.literal("speaking"),
    taskId: z.string().min(1),
    prompt: z.string().min(1),
    durationSec: z.number().int().nonnegative(),
    band: BandSpeaking.nullable().optional(),
    speakingFeatures: SpeakingFeatures,
    ts: z.number().optional(),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    const body = Body.parse(await req.json());

    const payload: Record<string, unknown> = {
      taskId: body.taskId,
      prompt: body.prompt,
      durationSec: body.durationSec,
    };

    if (body.type === "writing") {
      if (typeof body.words === "number") payload.words = body.words;
      if (body.band) payload.band = body.band;
    } else {
      if (body.band) payload.band = body.band;
      if (body.speakingFeatures) payload.speakingFeatures = body.speakingFeatures;
    }
    if (typeof body.ts === "number") payload.ts = body.ts;

    await saveScore(body.type, payload);
    return NextResponse.json({ ok: true, data: payload });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: { message: e?.message || "Invalid body" } },
      { status: 400 }
    );
  }
}

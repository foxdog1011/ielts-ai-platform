// apps/web/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listHistory, saveHistory, type HistoryRecord, type WritingRecord, type SpeakingRecord } from "@/lib/history";

// GET /api/history?type=writing&limit=20&offset=0
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const typeParam = searchParams.get("type");
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");

  const type: "writing" | "speaking" | undefined =
    typeParam === "writing" || typeParam === "speaking" ? (typeParam as any) : undefined;

  const limit = Number.isFinite(Number(limitParam)) ? Number(limitParam) : 50;
  const offset = Number.isFinite(Number(offsetParam)) ? Number(offsetParam) : 0;

  const rows = await listHistory({ type, limit, offset });
  return NextResponse.json({ ok: true, data: rows });
}

// POST /api/history
// body: { type, taskId, prompt, durationSec, ... }
const Body = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("writing"),
    taskId: z.string().min(1),
    prompt: z.string().min(1),
    durationSec: z.number().int().nonnegative(),
    words: z.number().int().nonnegative().optional(),
    band: z
      .object({
        overall: z.number().optional(),
        taskResponse: z.number().optional(),
        coherence: z.number().optional(),
        lexical: z.number().optional(),
        grammar: z.number().optional(),
      })
      .nullable()
      .optional(),
    ts: z.number().optional(),
  }),
  z.object({
    type: z.literal("speaking"),
    taskId: z.string().min(1),
    prompt: z.string().min(1),
    durationSec: z.number().int().nonnegative(),
    band: z
      .object({
        overall: z.number().optional(),
        content: z.number().optional(),
        grammar: z.number().optional(),
        vocab: z.number().optional(),
        fluency: z.number().optional(),
        pronunciation: z.number().optional(),
      })
      .nullable()
      .optional(),
    ts: z.number().optional(),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    const parsed = Body.parse(await req.json());

    // 明確組成 HistoryRecord，避免把寬鬆的 Record 丟到 saveHistory
    let rec: HistoryRecord;

    if (parsed.type === "writing") {
      const w: WritingRecord = {
        type: "writing",
        taskId: parsed.taskId,
        prompt: parsed.prompt,
        durationSec: parsed.durationSec,
        words: parsed.words,
        band: parsed.band ?? null,
        ts: parsed.ts,
      };
      rec = w;
    } else {
      const s: SpeakingRecord = {
        type: "speaking",
        taskId: parsed.taskId,
        prompt: parsed.prompt,
        durationSec: parsed.durationSec,
        band: parsed.band ?? null,
        ts: parsed.ts,
      };
      rec = s;
    }

    const saved = await saveHistory(rec);
    return NextResponse.json({ ok: true, data: saved });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: { message: e?.message || "Invalid body" } },
      { status: 400 }
    );
  }
}

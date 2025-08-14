// apps/web/app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listHistory, saveHistory } from "../../../lib/history";

// GET /api/history?type=writing&limit=20&offset=0
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const limit = Number(searchParams.get("limit") || 50);
  const offset = Number(searchParams.get("offset") || 0);

  const t = type === "writing" || type === "speaking" ? (type as "writing" | "speaking") : undefined;
  const rows = await listHistory({
    type: t,
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  return NextResponse.json({ ok: true, data: rows });
}

// POST /api/history
// body: { type, taskId, prompt, durationSec, words?, band? }
const Body = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("writing"),
    taskId: z.string().min(1),
    prompt: z.string().min(1),
    durationSec: z.number().int().nonnegative(),
    words: z.number().int().nonnegative(),
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
        speech: z.number().optional(),
      })
      .nullable()
      .optional(),
    ts: z.number().optional(),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    const body = Body.parse(await req.json());
    const rec = await saveHistory(body as any);
    return NextResponse.json({ ok: true, data: rec });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: { message: e?.message || "Invalid body" } },
      { status: 400 }
    );
  }
}

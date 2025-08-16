// apps/web/app/api/prompts/random/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  pickRandomPrompt,
  listPrompts,
  seedFromFiles,
  type WritingPart,
  type SpeakingPart,
  type PromptLevel,
} from "@/lib/promptStore";

const WRITING_PARTS = ["task1-ac", "task1-gt", "task2"] as const;
const SPEAKING_PARTS = ["part1", "part2", "part3"] as const;

const Query = z.object({
  type: z.enum(["writing", "speaking"]).optional(),
  part: z
    .union([
      z.custom<WritingPart>((v) => WRITING_PARTS.includes(v as any)),
      z.custom<SpeakingPart>((v) => SPEAKING_PARTS.includes(v as any)),
    ])
    .optional(),
  topic: z.string().optional(),
  level: z.enum(["5.0-6.0", "6.0-7.0", "7.0-8.0"]).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = Query.safeParse({
      type: searchParams.get("type") || undefined,
      part: searchParams.get("part") || undefined,
      topic: searchParams.get("topic") || undefined,
      level: searchParams.get("level") || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { message: "invalid query", issues: parsed.error.issues } },
        { status: 400 }
      );
    }
    const { type, part, topic, level } = parsed.data;

    // 先試抽一題
    let picked = await pickRandomPrompt({ type: type as any, part: part as any, topic: topic || undefined, level: level as PromptLevel | undefined });
    if (!picked) {
      // 題庫空 → 先 seed 一批
      await seedFromFiles();
      // 再抽一次（降級策略：依序放寬條件）
      const attempts: Array<Parameters<typeof listPrompts>[0]> = [
        { type: type as any, part: part as any, topic: topic || undefined, level: level as any, limit: 200, offset: 0 },
        { type: type as any, part: part as any, limit: 200, offset: 0 },
        { type: type as any, limit: 200, offset: 0 },
        { limit: 200, offset: 0 },
      ];
      for (const opt of attempts) {
        const rows = await listPrompts(opt);
        if (rows.length) { picked = rows[Math.floor(Math.random() * rows.length)]; break; }
      }
    }

    if (!picked) {
      return NextResponse.json(
        { ok: false, error: { message: "no prompt found (even after seeding)" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: picked });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: { message: e?.message || "random prompt error" } },
      { status: 500 }
    );
  }
}
